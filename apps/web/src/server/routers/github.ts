import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "../trpc";
import { getOctokit, listUserRepositories, getRepositoryPullRequests, parseRepoFullName } from "@/lib/github";
import { inngest } from "../inngest/client";

export const githubRouter = createTRPCRouter({
  listUserRepos: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.db.account.findFirst({
      where: { userId: ctx.session!.user.id, providerId: "github" },
    });
    if (!account?.accessToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "GitHub not connected" });

    return listUserRepositories(account.accessToken);
  }),

  connectRepo: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        githubId: z.number(),
        fullName: z.string(),
        defaultBranch: z.string().default("main"),
        private: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.subscription.findFirst({
        where: { workspaceId: input.workspaceId },
      });

      const repoCount = await ctx.db.repository.count({
        where: { workspaceId: input.workspaceId },
      });

      if (sub && repoCount >= sub.repoLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Repo limit (${sub.repoLimit}) reached. Upgrade your plan.`,
        });
      }

      return ctx.db.repository.upsert({
        where: { githubId: input.githubId },
        create: {
          workspaceId: input.workspaceId,
          githubId: input.githubId,
          fullName: input.fullName,
          defaultBranch: input.defaultBranch,
          private: input.private,
        },
        update: { workspaceId: input.workspaceId },
      });
    }),

  listRepos: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.repository.findMany({
        where: { workspaceId: input.workspaceId },
        include: { _count: { select: { pullRequests: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  listPRs: protectedProcedure
    .input(z.object({ repositoryId: z.string(), state: z.enum(["open", "closed", "all"]).default("open") }))
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.repository.findUnique({ where: { id: input.repositoryId } });
      if (!repo) throw new TRPCError({ code: "NOT_FOUND" });

      const account = await ctx.db.account.findFirst({
        where: { userId: ctx.session!.user.id, providerId: "github" },
      });
      if (!account?.accessToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "GitHub not connected" });

      const { owner, repo: repoName } = parseRepoFullName(repo.fullName);
      const octokit = getOctokit(account.accessToken);
      const prs = await getRepositoryPullRequests(octokit, owner, repoName, input.state);

      // Sync to database
      await Promise.all(
        prs.map((pr) =>
          ctx.db.pullRequest.upsert({
            where: { repositoryId_githubPrId: { repositoryId: repo.id, githubPrId: pr.id } },
            create: {
              repositoryId: repo.id,
              githubPrId: pr.id,
              number: pr.number,
              title: pr.title,
              body: pr.body,
              state: pr.state,
              headBranch: pr.head.ref,
              baseBranch: pr.base.ref,
              htmlUrl: pr.html_url,
              diffUrl: pr.diff_url,
            },
            update: { state: pr.state, title: pr.title, body: pr.body },
          })
        )
      );

      return prs;
    }),

  syncPR: protectedProcedure
    .input(z.object({ repositoryId: z.string(), prNumber: z.number(), featureId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.repository.findUnique({ where: { id: input.repositoryId } });
      if (!repo) throw new TRPCError({ code: "NOT_FOUND" });

      const account = await ctx.db.account.findFirst({
        where: { userId: ctx.session!.user.id, providerId: "github" },
      });
      if (!account?.accessToken) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      const { owner, repo: repoName } = parseRepoFullName(repo.fullName);
      const octokit = getOctokit(account.accessToken);
      const { data: pr } = await octokit.pulls.get({ owner, repo: repoName, pull_number: input.prNumber });

      const dbPR = await ctx.db.pullRequest.upsert({
        where: { repositoryId_githubPrId: { repositoryId: repo.id, githubPrId: pr.id } },
        create: {
          repositoryId: repo.id,
          featureId: input.featureId,
          githubPrId: pr.id,
          number: pr.number,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          headBranch: pr.head.ref,
          baseBranch: pr.base.ref,
          htmlUrl: pr.html_url,
          diffUrl: pr.diff_url,
        },
        update: { state: pr.state, featureId: input.featureId },
      });

      if (input.featureId) {
        await inngest.send({
          name: "pr/review",
          data: { pullRequestId: dbPR.id, featureId: input.featureId },
        });

        await ctx.db.featureRequest.update({
          where: { id: input.featureId },
          data: { status: "IN_REVIEW" },
        });
      }

      return dbPR;
    }),

  getStoredPRs: protectedProcedure
    .input(z.object({ repositoryId: z.string(), featureId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.pullRequest.findMany({
        where: {
          repositoryId: input.repositoryId,
          ...(input.featureId ? { featureId: input.featureId } : {}),
        },
        include: {
          reviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),
});
