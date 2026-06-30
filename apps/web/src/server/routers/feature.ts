import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "../trpc";
import { inngest } from "../inngest/client";

export const featureRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.featureRequest.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status ? { status: input.status as never } : {}),
        },
        include: {
          prd: { select: { id: true } },
          _count: { select: { tasks: true, messages: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findUnique({
        where: { id: input.id },
        include: {
          project: true,
          repository: true,
          prd: true,
          tasks: { orderBy: { order: "asc" } },
          messages: { orderBy: { createdAt: "asc" } },
          approvals: { include: { user: true }, orderBy: { createdAt: "desc" } },
        },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });
      return feature;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(3).max(200),
        description: z.string().min(10),
        source: z.enum(["MANUAL", "EMAIL", "SUPPORT_TICKET", "SLACK", "API"]).default("MANUAL"),
        repositoryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          source: input.source,
          repositoryId: input.repositoryId,
          status: "INTAKE",
        },
      });

      await inngest.send({
        name: "feature/clarify",
        data: { featureId: feature.id },
      });

      return feature;
    }),

  sendMessage: protectedProcedure
    .input(z.object({ featureId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findUnique({
        where: { id: input.featureId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.clarificationMessage.create({
        data: { featureId: input.featureId, role: "user", content: input.content },
      });

      await ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: "CLARIFYING" },
      });

      await inngest.send({
        name: "feature/clarify",
        data: { featureId: input.featureId, newMessage: input.content },
      });

      return { ok: true };
    }),

  generatePRD: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: "GENERATING_PRD" },
      });

      await inngest.send({
        name: "feature/generate-prd",
        data: { featureId: input.featureId },
      });

      return { ok: true };
    }),

  generateTasks: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: "PLANNING" },
      });

      await inngest.send({
        name: "feature/generate-tasks",
        data: { featureId: input.featureId },
      });

      return { ok: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ featureId: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: input.status as never },
      });
    }),

  approve: protectedProcedure
    .input(
      z.object({
        featureId: z.string(),
        decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const approval = await ctx.db.approval.create({
        data: {
          featureId: input.featureId,
          userId: ctx.session!.user.id,
          decision: input.decision,
          notes: input.notes,
        },
      });

      const newStatus = input.decision === "APPROVED" ? "APPROVED" : "REJECTED";
      await ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: newStatus },
      });

      return approval;
    }),

  ship: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.db.featureRequest.findUnique({
        where: { id: input.featureId },
        include: { approvals: true },
      });
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      const approved = feature.approvals.some((a) => a.decision === "APPROVED");
      if (!approved) throw new TRPCError({ code: "FORBIDDEN", message: "Feature must be approved before shipping" });

      return ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: "SHIPPED" },
      });
    }),

  listByWorkspace: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.featureRequest.findMany({
        where: { project: { workspaceId: input.workspaceId } },
        include: {
          project: { select: { name: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
      });
    }),
});
