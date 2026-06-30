import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { inngest } from "../inngest/client";

export const reviewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ pullRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.aIReview.findMany({
        where: { pullRequestId: input.pullRequestId },
        include: { comments: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  listByFeature: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.aIReview.findMany({
        where: { featureId: input.featureId },
        include: {
          pullRequest: { select: { title: true, number: true, htmlUrl: true } },
          comments: true,
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const review = await ctx.db.aIReview.findUnique({
        where: { id: input.id },
        include: { comments: true, pullRequest: true },
      });
      if (!review) throw new TRPCError({ code: "NOT_FOUND" });
      return review;
    }),

  triggerReview: protectedProcedure
    .input(z.object({ pullRequestId: z.string(), featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await inngest.send({
        name: "pr/review",
        data: { pullRequestId: input.pullRequestId, featureId: input.featureId },
      });

      await ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: "IN_REVIEW" },
      });

      return { ok: true };
    }),

  triggerReReview: protectedProcedure
    .input(z.object({ pullRequestId: z.string(), featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await inngest.send({
        name: "pr/review",
        data: { pullRequestId: input.pullRequestId, featureId: input.featureId, isReReview: true },
      });

      await ctx.db.featureRequest.update({
        where: { id: input.featureId },
        data: { status: "RE_REVIEWING" },
      });

      return { ok: true };
    }),
});
