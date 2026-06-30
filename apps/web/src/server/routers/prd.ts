import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const prdRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const prd = await ctx.db.pRD.findUnique({ where: { featureId: input.featureId } });
      if (!prd) throw new TRPCError({ code: "NOT_FOUND" });
      return prd;
    }),

  update: protectedProcedure
    .input(
      z.object({
        featureId: z.string(),
        problemStatement: z.string().optional(),
        goals: z.array(z.string()).optional(),
        nonGoals: z.array(z.string()).optional(),
        userStories: z.array(z.object({ as: z.string(), iWant: z.string(), soThat: z.string() })).optional(),
        acceptanceCriteria: z.array(z.string()).optional(),
        edgeCases: z.array(z.string()).optional(),
        successMetrics: z.array(z.object({ metric: z.string(), target: z.string(), measurement: z.string() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { featureId, ...data } = input;
      const prd = await ctx.db.pRD.update({
        where: { featureId },
        data: {
          ...data,
          version: { increment: 1 },
        },
      });

      await ctx.db.featureRequest.update({
        where: { id: featureId },
        data: { status: "PRD_READY" },
      });

      return prd;
    }),
});
