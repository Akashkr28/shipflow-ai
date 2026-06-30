"use client";

import { Loader2, Zap, GitPullRequest, KanbanSquare, CheckCircle2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FEATURE_STATUS_COLORS, FEATURE_STATUS_LABELS, relativeTime } from "@/lib/utils";

export default function WorkspaceDashboard() {
  const params = useParams<{ slug: string }>();
  const { data: workspace, isLoading: loadingWs } = trpc.workspace.get.useQuery({ slug: params.slug });
  const { data: stats, isLoading: loadingStats } = trpc.workspace.getStats.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: !!workspace?.id }
  );
  const { data: recentFeatures } = trpc.feature.listByWorkspace.useQuery(
    { workspaceId: workspace?.id ?? "", limit: 8 },
    { enabled: !!workspace?.id }
  );

  if (loadingWs || loadingStats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{workspace?.name}</h1>
        <p className="text-muted-foreground">
          {workspace?.plan} Plan · {workspace?.members.length} member{workspace?.members.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <KanbanSquare className="h-4 w-4" />
              <span className="text-sm">Total Features</span>
            </div>
            <div className="text-3xl font-bold">{stats?.features ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Shipped</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{stats?.shipped ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <GitPullRequest className="h-4 w-4 text-blue-500" />
              <span className="text-sm">AI Reviews</span>
            </div>
            <div className="text-3xl font-bold">{stats?.reviews ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">AI Credits</span>
            </div>
            <div className="text-3xl font-bold">
              {stats?.subscription?.aiCreditsUsed ?? 0}
              <span className="text-sm text-muted-foreground font-normal">/{stats?.subscription?.aiCreditsLimit ?? 10}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Features */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Features</h2>
        <Link href={`/workspace/${params.slug}/features`}>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> New Feature
          </Button>
        </Link>
      </div>

      {recentFeatures?.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground mb-4">No features yet</div>
          <Link href={`/workspace/${params.slug}/features`}>
            <Button>Create your first feature request</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {recentFeatures?.map((feature) => (
            <Link key={feature.id} href={`/workspace/${params.slug}/features/${feature.id}`}>
              <Card className="hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{feature.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {feature.project.name} · {relativeTime(feature.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge className={FEATURE_STATUS_COLORS[feature.status]}>
                      {FEATURE_STATUS_LABELS[feature.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
