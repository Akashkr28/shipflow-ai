import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma } from "@shipflow/db";
import { auth } from "@/lib/auth";

interface CreateContextOptions {
  req: NextRequest;
}

export async function createTRPCContext(opts: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: opts.req.headers,
  });

  return {
    db: prisma,
    session,
    req: opts.req,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const workspaceProcedure = protectedProcedure.use(async ({ ctx, next, getRawInput }) => {
  const rawInput = (await getRawInput()) as { workspaceId?: string } | undefined;
  const workspaceId = rawInput?.workspaceId;
  if (!workspaceId) throw new TRPCError({ code: "BAD_REQUEST", message: "workspaceId required" });

  const member = await ctx.db.workspaceMember.findFirst({
    where: { workspaceId, userId: ctx.session!.user.id },
    include: { workspace: true },
  });

  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });

  return next({ ctx: { ...ctx, workspace: member.workspace, member } });
});
