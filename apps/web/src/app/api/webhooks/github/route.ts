import { type NextRequest, NextResponse } from "next/server";
import { Webhooks } from "@octokit/webhooks";
import { prisma } from "@shipflow/db";
import { inngest } from "@/server/inngest/client";

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET || "development",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const event = req.headers.get("x-github-event") || "";

  try {
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      const isValid = await webhooks.verify(body, signature);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);

    if (event === "pull_request") {
      const { action, pull_request, repository } = payload;

      const repo = await prisma.repository.findFirst({
        where: { githubId: repository.id },
      });

      if (!repo) {
        return NextResponse.json({ message: "Repository not tracked" });
      }

      const pr = await prisma.pullRequest.upsert({
        where: {
          repositoryId_githubPrId: {
            repositoryId: repo.id,
            githubPrId: pull_request.id,
          },
        },
        create: {
          repositoryId: repo.id,
          githubPrId: pull_request.id,
          number: pull_request.number,
          title: pull_request.title,
          body: pull_request.body,
          state: pull_request.state,
          headBranch: pull_request.head.ref,
          baseBranch: pull_request.base.ref,
          htmlUrl: pull_request.html_url,
          diffUrl: pull_request.diff_url,
        },
        update: {
          state: pull_request.state,
          title: pull_request.title,
          body: pull_request.body,
        },
      });

      if (action === "opened" || action === "synchronize") {
        const feature = await prisma.featureRequest.findFirst({
          where: { repositoryId: repo.id, status: "IN_DEVELOPMENT" },
        });

        if (feature) {
          await prisma.pullRequest.update({
            where: { id: pr.id },
            data: { featureId: feature.id },
          });

          await inngest.send({
            name: "pr/review",
            data: {
              pullRequestId: pr.id,
              featureId: feature.id,
              isReReview: action === "synchronize",
            },
          });
        }
      }
    }

    return NextResponse.json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
