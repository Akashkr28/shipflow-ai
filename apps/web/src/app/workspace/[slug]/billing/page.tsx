"use client";

import { useState } from "react";
import { CreditCard, Zap, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "next/navigation";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function BillingPage() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"PRO" | "ENTERPRISE" | null>(null);

  const { data: workspace } = trpc.workspace.get.useQuery({ slug: params.slug });
  const { data: subscription } = trpc.billing.getSubscription.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: !!workspace?.id }
  );
  const { data: plans } = trpc.billing.getPlans.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: !!workspace?.id }
  );

  const createOrder = trpc.billing.createOrder.useMutation();
  const confirmPayment = trpc.billing.confirmPayment.useMutation({
    onSuccess: () => {
      toast({ title: "Subscription activated!", description: "Welcome to the Pro plan!" });
    },
  });

  async function handleUpgrade(plan: "PRO" | "ENTERPRISE") {
    if (!workspace?.id) return;
    setSelectedPlan(plan);

    try {
      const order = await createOrder.mutateAsync({ workspaceId: workspace.id, plan });

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(script);
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "ShipFlow AI",
          description: `${plan} Plan Subscription`,
          order_id: order.orderId,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            await confirmPayment.mutateAsync({
              workspaceId: workspace.id,
              plan,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          },
          prefill: { email: "" },
          theme: { color: "#7c3aed" },
        });
        rzp.open();
      };
    } catch (e: unknown) {
      const err = e as Error;
      toast({ title: err.message || "Payment failed", variant: "destructive" });
    } finally {
      setSelectedPlan(null);
    }
  }

  const currentPlan = subscription?.plan ?? "FREE";
  const creditsUsed = subscription?.aiCreditsUsed ?? 0;
  const creditsLimit = subscription?.aiCreditsLimit ?? 10;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Billing & Plans
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and AI credits</p>
      </div>

      {/* Current Usage */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Current Plan: {currentPlan}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-yellow-500" /> AI Credits Used
              </span>
              <span>
                {creditsUsed} / {creditsLimit === -1 ? "∞" : creditsLimit}
              </span>
            </div>
            <Progress value={creditsLimit > 0 ? (creditsUsed / creditsLimit) * 100 : 0} />
          </div>
          <div className="text-sm text-muted-foreground">
            Repository limit: {subscription?.repoLimit === -1 ? "Unlimited" : subscription?.repoLimit ?? 1}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPro = plan.id === "PRO";
          return (
            <Card
              key={plan.id}
              className={`relative ${isPro ? "border-primary shadow-lg" : ""} ${isCurrent ? "opacity-75" : ""}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ₹{plan.price.toLocaleString()}
                  </span>
                  {plan.price > 0 && <span className="text-muted-foreground">/month</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button className="w-full" variant="secondary" disabled>
                    Current Plan
                  </Button>
                ) : plan.id !== "FREE" ? (
                  <Button
                    className="w-full"
                    variant={isPro ? "default" : "outline"}
                    onClick={() => handleUpgrade(plan.id as "PRO" | "ENTERPRISE")}
                    disabled={createOrder.isPending && selectedPlan === plan.id}
                  >
                    {createOrder.isPending && selectedPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Upgrade to {plan.name}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
