import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "../trpc";
import { slugify } from "@/lib/utils";

export const workspaceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.workspaceMember.findMany({
      where: { userId: ctx.session!.user.id },
      include: { workspace: true },
      orderBy: { workspace: { createdAt: "asc" } },
    });
  }),

  get: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const workspace = await ctx.db.workspace.findUnique({
      where: { slug: input.slug },
      include: {
        members: { include: { user: true } },
        _count: { select: { projects: true, repositories: true } },
      },
    });
    if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

    const isMember = workspace.members.some((m) => m.userId === ctx.session!.user.id);
    if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

    return workspace;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(2).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const baseSlug = slugify(input.name);
      let slug = baseSlug;
      let attempt = 0;

      while (await ctx.db.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${++attempt}`;
      }

      const workspace = await ctx.db.workspace.create({
        data: {
          name: input.name,
          slug,
          members: {
            create: { userId: ctx.session!.user.id, role: "OWNER" },
          },
          subscriptions: {
            create: { plan: "FREE", aiCreditsLimit: 10, repoLimit: 1 },
          },
        },
      });

      return workspace;
    }),

  invite: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), email: z.string().email(), role: z.enum(["ADMIN", "MEMBER", "VIEWER"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!["OWNER", "ADMIN"].includes(ctx.member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const user = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      return ctx.db.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: user.id } },
        create: { workspaceId: input.workspaceId, userId: user.id, role: input.role },
        update: { role: input.role },
      });
    }),

  getMembers: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });
    }),

  getStats: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [features, shipped, reviews, subscription] = await Promise.all([
        ctx.db.featureRequest.count({
          where: { project: { workspaceId: input.workspaceId } },
        }),
        ctx.db.featureRequest.count({
          where: { project: { workspaceId: input.workspaceId }, status: "SHIPPED" },
        }),
        ctx.db.aIReview.count({
          where: {
            pullRequest: { repository: { workspaceId: input.workspaceId } },
          },
        }),
        ctx.db.subscription.findFirst({
          where: { workspaceId: input.workspaceId },
        }),
      ]);

      return { features, shipped, reviews, subscription };
    }),
});
