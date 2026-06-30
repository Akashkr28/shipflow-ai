import { createTRPCRouter } from "./trpc";
import { workspaceRouter } from "./routers/workspace";
import { featureRouter } from "./routers/feature";
import { prdRouter } from "./routers/prd";
import { taskRouter } from "./routers/task";
import { githubRouter } from "./routers/github";
import { reviewRouter } from "./routers/review";
import { billingRouter } from "./routers/billing";
import { notificationRouter } from "./routers/notification";

export const appRouter = createTRPCRouter({
  workspace: workspaceRouter,
  feature: featureRouter,
  prd: prdRouter,
  task: taskRouter,
  github: githubRouter,
  review: reviewRouter,
  billing: billingRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
