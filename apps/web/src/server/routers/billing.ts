import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, workspaceProcedure } from "../trpc";

const RAZORPAY_PLANS = {
  PRO: {
    planId: process.env.RAZORPAY_PRO_PLAN_ID || "plan_pro",
    name: "Pro",
    price: 2999,
    currency: "INR",
    aiCredits: 100,
    repoLimit: 10,
  },
  ENTERPRISE: {
    planId: process.env.RAZORPAY_ENTERPRISE_PLAN_ID || "plan_enterprise",
    name: "Enterprise",
    price: 9999,
    currency: "INR",
    aiCredits: 1000,
    repoLimit: -1,
  },
};

export const billingRouter = createTRPCRouter({
  getSubscription: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.subscription.findFirst({
        where: { workspaceId: input.workspaceId },
      });
    }),

  getPlans: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(() => {
      return [
        {
          id: "FREE",
          name: "Free",
          price: 0,
          currency: "INR",
          aiCredits: 10,
          repoLimit: 1,
          features: ["10 AI reviews/month", "1 repository", "Basic workflows"],
        },
        {
          id: "PRO",
          name: "Pro",
          price: 2999,
          currency: "INR",
          aiCredits: 100,
          repoLimit: 10,
          features: ["100 AI reviews/month", "10 repositories", "Full workflows", "Priority support"],
        },
        {
          id: "ENTERPRISE",
          name: "Enterprise",
          price: 9999,
          currency: "INR",
          aiCredits: 1000,
          repoLimit: -1,
          features: ["1000 AI reviews/month", "Unlimited repositories", "SSO", "SLA support"],
        },
      ];
    }),

  createOrder: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), plan: z.enum(["PRO", "ENTERPRISE"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!["OWNER", "ADMIN"].includes(ctx.member.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const planConfig = RAZORPAY_PLANS[input.plan];

      // Create Razorpay order via API
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          amount: planConfig.price * 100,
          currency: planConfig.currency,
          receipt: `ws_${input.workspaceId}_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create payment order" });
      }

      const order = await response.json() as { id: string };

      return {
        orderId: order.id,
        amount: planConfig.price * 100,
        currency: planConfig.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        plan: input.plan,
      };
    }),

  confirmPayment: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        plan: z.enum(["PRO", "ENTERPRISE"]),
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const planConfig = RAZORPAY_PLANS[input.plan];

      await ctx.db.subscription.upsert({
        where: { workspaceId: input.workspaceId } as never,
        create: {
          workspaceId: input.workspaceId,
          plan: input.plan,
          status: "ACTIVE",
          aiCreditsLimit: planConfig.aiCredits,
          repoLimit: planConfig.repoLimit,
        },
        update: {
          plan: input.plan,
          status: "ACTIVE",
          aiCreditsLimit: planConfig.aiCredits,
          repoLimit: planConfig.repoLimit,
          aiCreditsUsed: 0,
        },
      });

      await ctx.db.workspace.update({
        where: { id: input.workspaceId },
        data: { plan: input.plan },
      });

      return { ok: true };
    }),
});
