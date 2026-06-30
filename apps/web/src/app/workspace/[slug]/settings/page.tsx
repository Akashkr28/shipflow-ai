"use client";

import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";

export default function SettingsPage() {
  const params = useParams<{ slug: string }>();
  const { data: workspace } = trpc.workspace.get.useQuery({ slug: params.slug });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Workspace Settings
        </h1>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Workspace Name</span>
              <span className="font-medium">{workspace?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono">{workspace?.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="outline">{workspace?.plan}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">GitHub Webhook</CardTitle>
            <CardDescription>Configure automated review triggers</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all">
              {typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/webhooks/github
            </div>
            <p className="text-muted-foreground mt-2">
              Add this URL to your GitHub repository webhooks. Select &quot;Pull request&quot; events.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inngest Workflows</CardTitle>
            <CardDescription>Background AI job processing</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {[
              "feature/clarify — AI requirements clarification",
              "feature/generate-prd — PRD generation",
              "feature/generate-tasks — Task breakdown",
              "pr/review — AI code review",
            ].map((w) => (
              <div key={w} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="font-mono text-xs">{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
