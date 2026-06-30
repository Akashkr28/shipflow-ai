# ShipFlow AI — Feature to Production

An AI-powered product delivery platform that takes a software team from a raw feature request all the way to a shipped, production feature — with AI agents handling requirements clarification, PRD generation, task planning, and code review at every step.

> **Core Loop:** Feature Request → Clarification → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship

## Live Demo

- **App:** _add your Vercel URL here once deployed_
- **Demo video:** _add your video link here_
- **Repo:** https://github.com/Akashkr28/shipflow-ai

## Project Overview

ShipFlow AI models the entire software delivery lifecycle as a state machine driven by AI agents and gated by human approval:

1. **Product Discovery** — A feature request comes in from any channel (manual entry, email, support ticket, Slack, API). An AI agent has a clarification conversation with the requester: it checks for duplicates/existing functionality, decides if the feature is actually needed, and asks targeted follow-up questions until it has enough context.
2. **PRD Generation** — Once context is sufficient, AI generates a structured PRD: problem statement, goals, non-goals, user stories, acceptance criteria, edge cases, and success metrics. Humans can edit the PRD before moving forward.
3. **Task Planning** — The PRD is broken down into concrete engineering tasks, organized on a Kanban board (To Do / In Progress / In Review / Done).
4. **Development** — Repositories are connected via GitHub. Developers (or coding agents) implement the feature and open a pull request.
5. **AI Review Loop** — A QA agent reviews the PR's diff against the PRD, acceptance criteria, tasks, security, performance, and edge cases — and posts a structured comment back to the GitHub PR. Issues are tagged `BLOCKING`, `NON_BLOCKING`, or `SUGGESTION`. If blocking issues exist, the feature returns to a "Fix Needed" state; once new commits land, the AI re-reviews automatically.
6. **Human Approval** — A human reviewer sees the full picture (PRD, tasks, PR, review history, outstanding issues) and approves or rejects. Only approved features can be marked **Shipped**.

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo (npm workspaces) |
| Frontend | Next.js 15 (App Router), React 19 |
| API | tRPC v11 (type-safe, no REST boilerplate) |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Auth | BetterAuth (email/password + GitHub/Google OAuth) |
| Database | PostgreSQL |
| ORM | Prisma |
| AI | Vercel AI SDK + Anthropic Claude (Sonnet) |
| Async workflows | Inngest |
| GitHub integration | Octokit (REST) + GitHub Webhooks |
| Billing | Razorpay |
| Deployment | Vercel |

## Architecture

```
shipflow-ai/
├── apps/
│   └── web/                     # Next.js app (UI + tRPC API + Inngest functions)
│       ├── src/app/             # App Router pages & API routes
│       │   ├── api/trpc/        # tRPC HTTP handler
│       │   ├── api/auth/        # BetterAuth handler
│       │   ├── api/inngest/     # Inngest function server
│       │   ├── api/webhooks/    # GitHub webhook receiver
│       │   ├── auth/            # Sign in / sign up
│       │   ├── dashboard/       # Workspace picker
│       │   └── workspace/[slug] # Main app: features, github, billing, members, settings
│       ├── src/server/
│       │   ├── routers/         # tRPC routers (workspace, feature, prd, task, github, review, billing, notification)
│       │   ├── inngest/         # Inngest client + background functions
│       │   └── trpc.ts          # Context, procedures (public/protected/workspace-scoped)
│       ├── src/lib/             # auth, ai (Claude prompts), github (Octokit helpers), utils
│       └── src/components/      # shadcn/ui primitives + feature components
└── packages/
    └── db/                      # Prisma schema + generated client, shared via workspace package
```

**Why this shape:** tRPC routers live inside the Next.js app (not a separate API app) because Next.js API routes already give us serverless deployment on Vercel for free, and a single Node process can host both the web UI and the Inngest function server. The Prisma schema is isolated in `packages/db` so it could be shared with a future worker app without duplicating models.

## Database Schema Notes

Multi-tenancy is modeled with a `Workspace` as the top-level tenant. Every other domain object hangs off a workspace, directly or transitively:

- `Workspace` → `WorkspaceMember` (role: OWNER/ADMIN/MEMBER/VIEWER) → `User`
- `Workspace` → `Project` → `FeatureRequest` (the core lifecycle entity, driven by the `FeatureStatus` enum: `INTAKE → CLARIFYING → READY_FOR_PRD → GENERATING_PRD → PRD_READY → PLANNING → TASKS_READY → IN_DEVELOPMENT → IN_REVIEW → FIX_NEEDED ⇄ RE_REVIEWING → PENDING_APPROVAL → APPROVED → SHIPPED` (or `REJECTED` / `DUPLICATE` / `NOT_NEEDED` at any point)
- `FeatureRequest` → `ClarificationMessage[]` (the AI discovery conversation), `PRD` (1:1), `Task[]` (Kanban), `Approval[]` (human decision audit trail)
- `Workspace` → `Repository` (GitHub repo, linked optionally via `GitHubInstall` for GitHub App installations) → `PullRequest[]` → `AIReview[]` → `ReviewComment[]` (severity: BLOCKING/NON_BLOCKING/SUGGESTION)
- `Workspace` → `Subscription` (plan, AI credit usage, repo limits) — billing state lives per-workspace, not per-user
- `WorkflowRun` tracks Inngest job execution for visibility into long-running AI tasks

Auth tables (`User`, `Session`, `Account`, `Verification`) follow BetterAuth's expected Prisma shape so the adapter works out of the box.

Run `npm run db:push` (or `prisma migrate dev` for tracked migrations) from the repo root to sync the schema.

## AI Features Implemented

All AI calls go through `apps/web/src/lib/ai.ts`, using the Vercel AI SDK with Anthropic's Claude:

- **`clarifyRequirements`** — conversational agent that interviews the requester, checks for existing/duplicate functionality, and signals `READY_FOR_PRD` when it has enough context.
- **`generatePRD`** — turns the request + clarification transcript into a structured PRD object (problem statement, goals, non-goals, user stories, acceptance criteria, edge cases, success metrics).
- **`generateTasks`** — decomposes a PRD into 5–12 concrete engineering tasks with priority and ordering.
- **`reviewPullRequest`** — the QA/engineering reviewer. Given the PR diff, PRD, tasks, and acceptance criteria, it returns a score (0–100), an approve/reject verdict, and a list of categorized issues (`requirements`, `security`, `performance`, `edge_case`, `code_quality`, `tests`) each tagged `BLOCKING`/`NON_BLOCKING`/`SUGGESTION` with an explanation of *why* it's an issue — not just a syntax linter.
- **`checkReleaseReadiness`** — aggregates PRD goals, task completion, and review history into a release-readiness verdict with blockers and recommendations, surfaced on the Approval tab.

## GitHub Integration

- **OAuth** — users connect their GitHub account via BetterAuth's GitHub provider; the resulting access token is reused for Octokit calls (`apps/web/src/lib/github.ts`).
- **Repository connection** — `github.listUserRepos` lists the authenticated user's repos via Octokit; `github.connectRepo` links one to a workspace (gated by the workspace's `repoLimit`).
- **Pull request tracking** — `github.listPRs` / `github.syncPR` fetch live PR data from GitHub and upsert it into the `PullRequest` table — no hardcoded PR data anywhere.
- **Diffs** — `getPullRequestDiff` fetches the raw diff via Octokit's `pulls.get` with `mediaType: { format: "diff" }`, which is fed directly into the AI review prompt.
- **Webhooks** — `apps/web/src/app/api/webhooks/github/route.ts` verifies the `x-hub-signature-256` signature and handles `pull_request` events (`opened`/`synchronize`), automatically linking the PR to an in-development feature and enqueuing an Inngest review job.
- **Posting reviews back** — after an AI review completes, `postReviewComment` posts a formatted summary (score, verdict, issues) as a comment on the actual GitHub PR.

### Setting up the GitHub side

1. Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps) for user sign-in; set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
2. (Optional, for org-wide installs) Create a GitHub App for webhook-based integration; set `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY`.
3. On each repository you connect, add a webhook pointing to `https://<your-domain>/api/webhooks/github`, content type `application/json`, secret matching `GITHUB_WEBHOOK_SECRET`, subscribed to **Pull requests** events.

## Inngest Workflow Explanation

Long-running AI work is never done inline in a tRPC mutation — mutations enqueue an Inngest event and return immediately; the actual AI call happens in a step-function so progress survives retries and is observable in the Inngest dashboard. Functions live in `apps/web/src/server/inngest/functions.ts`, served from `apps/web/src/app/api/inngest/route.ts`:

| Event | Function | What it does |
|---|---|---|
| `feature/clarify` | `clarifyFeature` | Loads the conversation, calls the clarification agent, persists the AI's response, flips status to `READY_FOR_PRD` once satisfied |
| `feature/generate-prd` | `generatePRDFunction` | Generates and upserts the structured PRD, sets status to `PRD_READY` |
| `feature/generate-tasks` | `generateTasksFunction` | Replaces existing tasks with a freshly generated set, sets status to `TASKS_READY` |
| `pr/review` | `reviewPRFunction` | Fetches the live diff from GitHub, runs the AI review, persists score/issues, posts a comment back to the PR, and routes the feature to `PENDING_APPROVAL` or `FIX_NEEDED` depending on the verdict |

Each function is built from `step.run(...)` calls so individual steps (fetch diff, call AI, write DB, post to GitHub) are retried independently on failure rather than re-running the whole job. Workflow progress is visible to users directly through the feature's status badge and the Discovery/Reviews tabs, which poll the underlying tRPC queries.

## SaaS / Multi-Tenancy & Billing

Every workspace has its own users (via `WorkspaceMember`), projects, repositories, feature requests, PRDs, tasks, and review history — enforced by the `workspaceProcedure` tRPC middleware, which checks workspace membership before any workspace-scoped query/mutation runs.

Billing is implemented with Razorpay:
- `billing.createOrder` creates a Razorpay order for the Pro/Enterprise plan.
- The client loads Razorpay Checkout and opens it with the returned order.
- `billing.confirmPayment` is called from the checkout success handler and upgrades the workspace's `Subscription` (plan, AI credit limit, repo limit).
- Free plan: 10 AI credits/month, 1 repository. Pro: 100 credits, 10 repos. Enterprise: 1000 credits, unlimited repos.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted, e.g. Neon/Supabase/Railway)
- Anthropic API key
- GitHub OAuth App credentials
- (Optional) Inngest account, Razorpay account

### Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Configure environment
cp apps/web/.env.example apps/web/.env.local
# fill in DATABASE_URL, ANTHROPIC_API_KEY, GITHUB_CLIENT_ID/SECRET, etc.

# Push schema to your database
npm run db:push

# Generate Prisma client
npm run db:generate

# Run the app
npm run dev
```

The app runs at `http://localhost:3000`. Inngest functions are served from `/api/inngest` — for local development, run the Inngest Dev Server alongside:

```bash
npx inngest-cli@latest dev
```

### Environment Variables

See `apps/web/.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (32+ chars) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth for sign-in |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | GitHub App for org-wide repo access (optional) |
| `GITHUB_WEBHOOK_SECRET` | Verifies incoming GitHub webhook signatures |
| `ANTHROPIC_API_KEY` | Powers all AI features via the Vercel AI SDK |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest Cloud credentials (use `local`/blank for local dev server) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Billing |

### Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it into Vercel, set the root directory to `apps/web`.
3. Add all environment variables from `.env.example` in the Vercel project settings.
4. Set `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` to your deployed domain.
5. Register your production GitHub webhook URL (`https://<domain>/api/webhooks/github`) and sync the Inngest app via the Inngest Vercel integration.

## Rules Followed

- ✅ tRPC monorepo with separate `apps/` and `packages/`
- ✅ Next.js for the web app
- ✅ tRPC for all type-safe client/server communication
- ✅ PostgreSQL + Prisma for modeling and access
- ✅ BetterAuth for authentication (email/password + OAuth)
- ✅ Razorpay for billing
- ✅ Octokit + GitHub Webhooks for live GitHub integration — no hardcoded PR data
- ✅ AI SDK (Anthropic) powering clarification, PRD generation, task generation, code review, and release readiness checks
- ✅ Inngest for every long-running AI workflow
