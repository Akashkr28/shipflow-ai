import { inngest } from "./client";
import { prisma } from "@shipflow/db";
import {
  clarifyRequirements,
  generatePRD as aiGeneratePRD,
  generateTasks as aiGenerateTasks,
  reviewPullRequest,
} from "@/lib/ai";
import { getOctokit, getPullRequestDiff, postReviewComment, parseRepoFullName } from "@/lib/github";

export const clarifyFeature = inngest.createFunction(
  { id: "clarify-feature", name: "AI: Clarify Feature Requirements" },
  { event: "feature/clarify" },
  async ({ event, step }) => {
    const { featureId } = event.data;

    const feature = await step.run("load-feature", async () => {
      return prisma.featureRequest.findUnique({
        where: { id: featureId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    });

    if (!feature) throw new Error(`Feature ${featureId} not found`);

    await step.run("update-status", async () => {
      return prisma.featureRequest.update({
        where: { id: featureId },
        data: { status: "CLARIFYING" },
      });
    });

    const conversationHistory = feature.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await step.run("ai-clarify", async () => {
      return clarifyRequirements(feature.title, feature.description, conversationHistory);
    });

    await step.run("save-response", async () => {
      await prisma.clarificationMessage.create({
        data: { featureId, role: "assistant", content: response },
      });

      if (response.includes("READY_FOR_PRD")) {
        await prisma.featureRequest.update({
          where: { id: featureId },
          data: { status: "READY_FOR_PRD" },
        });
      }
    });

    return { featureId, response };
  }
);

export const generatePRDFunction = inngest.createFunction(
  { id: "generate-prd", name: "AI: Generate PRD" },
  { event: "feature/generate-prd" },
  async ({ event, step }) => {
    const { featureId } = event.data;

    const feature = await step.run("load-feature", async () => {
      return prisma.featureRequest.findUnique({
        where: { id: featureId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    });

    if (!feature) throw new Error(`Feature ${featureId} not found`);

    await step.run("set-generating", async () => {
      return prisma.featureRequest.update({
        where: { id: featureId },
        data: { status: "GENERATING_PRD" },
      });
    });

    const clarifications = feature.messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n");

    const prdData = await step.run("generate-prd", async () => {
      return aiGeneratePRD(feature.title, feature.description, clarifications);
    });

    await step.run("save-prd", async () => {
      await prisma.pRD.upsert({
        where: { featureId },
        create: { featureId, ...prdData },
        update: { ...prdData, version: { increment: 1 } },
      });

      await prisma.featureRequest.update({
        where: { id: featureId },
        data: { status: "PRD_READY" },
      });
    });

    return { featureId, prdData };
  }
);

export const generateTasksFunction = inngest.createFunction(
  { id: "generate-tasks", name: "AI: Generate Engineering Tasks" },
  { event: "feature/generate-tasks" },
  async ({ event, step }) => {
    const { featureId } = event.data;

    const [feature, prd] = await step.run("load-data", async () => {
      return Promise.all([
        prisma.featureRequest.findUnique({ where: { id: featureId } }),
        prisma.pRD.findUnique({ where: { featureId } }),
      ]);
    });

    if (!feature || !prd) throw new Error("Feature or PRD not found");

    const tasks = await step.run("generate-tasks", async () => {
      return aiGenerateTasks(
        {
          problemStatement: prd.problemStatement,
          goals: prd.goals,
          acceptanceCriteria: prd.acceptanceCriteria,
          userStories: prd.userStories,
        },
        feature.title
      );
    });

    await step.run("save-tasks", async () => {
      await prisma.task.deleteMany({ where: { featureId } });
      await prisma.task.createMany({
        data: tasks.map((t: { title: string; description: string; priority: string; order: number }) => ({
          featureId,
          title: t.title,
          description: t.description,
          priority: t.priority || "MEDIUM",
          order: t.order || 0,
          status: "TODO",
        })),
      });

      await prisma.featureRequest.update({
        where: { id: featureId },
        data: { status: "TASKS_READY" },
      });
    });

    return { featureId, taskCount: tasks.length };
  }
);

export const reviewPRFunction = inngest.createFunction(
  { id: "review-pr", name: "AI: Review Pull Request" },
  { event: "pr/review" },
  async ({ event, step }) => {
    const { pullRequestId, featureId, isReReview } = event.data;

    const [pr, feature] = await step.run("load-data", async () => {
      return Promise.all([
        prisma.pullRequest.findUnique({
          where: { id: pullRequestId },
          include: { repository: true },
        }),
        featureId
          ? prisma.featureRequest.findUnique({
              where: { id: featureId },
              include: { prd: true, tasks: true },
            })
          : null,
      ]);
    });

    if (!pr) throw new Error("PR not found");

    const review = await step.run("create-review", async () => {
      return prisma.aIReview.create({
        data: {
          pullRequestId,
          featureId,
          status: "IN_PROGRESS",
        },
      });
    });

    const diff = await step.run("fetch-diff", async () => {
      const account = await prisma.account.findFirst({
        where: { providerId: "github" },
      });
      if (!account?.accessToken) throw new Error("No GitHub account");

      const octokit = getOctokit(account.accessToken);
      const { owner, repo } = parseRepoFullName(pr.repository.fullName);
      return getPullRequestDiff(octokit, owner, repo, pr.number);
    });

    const reviewResult = await step.run("ai-review", async () => {
      const prd = feature?.prd;
      const tasks = feature?.tasks ?? [];

      return reviewPullRequest({
        prTitle: pr.title,
        prBody: pr.body ?? "",
        diff,
        prd: prd
          ? {
              problemStatement: prd.problemStatement,
              goals: prd.goals,
              acceptanceCriteria: prd.acceptanceCriteria,
              nonGoals: prd.nonGoals,
              edgeCases: prd.edgeCases,
            }
          : {},
        tasks: tasks.map((t) => ({ title: t.title, description: t.description })),
        acceptanceCriteria: (prd?.acceptanceCriteria as string[]) ?? [],
      });
    });

    await step.run("save-review", async () => {
      await prisma.aIReview.update({
        where: { id: review.id },
        data: {
          status: "COMPLETED",
          summary: reviewResult.summary,
          score: reviewResult.score,
          approved: reviewResult.approved,
          issues: reviewResult.issues,
        },
      });

      if (reviewResult.issues?.length > 0) {
        await prisma.reviewComment.createMany({
          data: (reviewResult.issues as Array<{
            file?: string;
            line?: number;
            severity: string;
            category?: string;
            body: string;
          }>).map((issue) => ({
            reviewId: review.id,
            file: issue.file,
            line: issue.line,
            severity: (issue.severity || "NON_BLOCKING") as "BLOCKING" | "NON_BLOCKING" | "SUGGESTION",
            category: issue.category,
            body: issue.body,
          })),
        });
      }

      if (featureId) {
        const hasBlockingIssues = (reviewResult.issues as Array<{ severity: string }>)?.some(
          (i) => i.severity === "BLOCKING"
        );

        const newStatus = reviewResult.approved && !hasBlockingIssues ? "PENDING_APPROVAL" : "FIX_NEEDED";

        await prisma.featureRequest.update({
          where: { id: featureId },
          data: { status: newStatus },
        });
      }
    });

    await step.run("post-github-comment", async () => {
      const account = await prisma.account.findFirst({
        where: { providerId: "github" },
      });
      if (!account?.accessToken) return;

      const octokit = getOctokit(account.accessToken);
      const { owner, repo } = parseRepoFullName(pr.repository.fullName);

      const blockingCount = (reviewResult.issues as Array<{ severity: string }>)?.filter(
        (i) => i.severity === "BLOCKING"
      ).length ?? 0;

      const commentBody = `## ShipFlow AI Review ${reviewResult.approved ? "✅" : "❌"}

**Score:** ${reviewResult.score}/100 | **Blocking Issues:** ${blockingCount}

${reviewResult.summary}

${
  reviewResult.issues?.length > 0
    ? `### Issues Found\n${(reviewResult.issues as Array<{ severity: string; category?: string; body: string }>)
        .map(
          (i) =>
            `- **[${i.severity}]** ${i.category ? `*(${i.category})*` : ""} ${i.body}`
        )
        .join("\n")}`
    : "No issues found."
}

*Reviewed by [ShipFlow AI](${process.env.NEXT_PUBLIC_APP_URL})*`;

      await postReviewComment(octokit, owner, repo, pr.number, commentBody);
    });

    return { reviewId: review.id, approved: reviewResult.approved, score: reviewResult.score };
  }
);

export const functions = [
  clarifyFeature,
  generatePRDFunction,
  generateTasksFunction,
  reviewPRFunction,
];
