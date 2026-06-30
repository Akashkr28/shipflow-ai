import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const taskRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findMany({
        where: { featureId: input.featureId },
        orderBy: { order: "asc" },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.task.update({ where: { id }, data });
    }),

  reorder: protectedProcedure
    .input(z.object({ tasks: z.array(z.object({ id: z.string(), order: z.number(), status: z.string() })) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.tasks.map((t) =>
          ctx.db.task.update({
            where: { id: t.id },
            data: { order: t.order, status: t.status as never },
          })
        )
      );
      return { ok: true };
    }),

  create: protectedProcedure
    .input(
      z.object({
        featureId: z.string(),
        title: z.string(),
        description: z.string(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.task.count({ where: { featureId: input.featureId } });
      return ctx.db.task.create({
        data: { ...input, order: count },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.delete({ where: { id: input.id } });
    }),
});
