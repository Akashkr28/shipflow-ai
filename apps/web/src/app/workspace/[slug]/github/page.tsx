"use client";

import { useState } from "react";
import { GitPullRequest, Github, Loader2, Plus, ExternalLink, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "next/navigation";
import { relativeTime } from "@/lib/utils";

export default function GitHubPage() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const { data: workspace } = trpc.workspace.get.useQuery({ slug: params.slug });
  const { data: userRepos, isLoading: loadingRepos } = trpc.github.listUserRepos.useQuery();
  const { data: connectedRepos, refetch } = trpc.github.listRepos.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: !!workspace?.id }
  );

  const connectRepo = trpc.github.connectRepo.useMutation({
    onSuccess: () => {
      toast({ title: "Repository connected!" });
      setConnectOpen(false);
      refetch();
    },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const { data: prs, isLoading: loadingPRs } = trpc.github.getStoredPRs.useQuery(
    { repositoryId: selectedRepo ?? "" },
    { enabled: !!selectedRepo }
  );

  const triggerReview = trpc.review.triggerReview.useMutation({
    onSuccess: () => toast({ title: "AI review triggered!" }),
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Github className="h-6 w-6" />
            GitHub Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect repositories and track pull requests for AI-powered reviews
          </p>
        </div>
        <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Connect Repository
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect GitHub Repository</DialogTitle>
            </DialogHeader>
            {loadingRepos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !userRepos ? (
              <div className="text-center py-8">
                <Github className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">GitHub not connected to your account</p>
                <Button
                  onClick={() => {
                    window.location.href = "/api/auth/signin?provider=github";
                  }}
                  className="gap-2"
                >
                  <Github className="h-4 w-4" /> Connect GitHub Account
                </Button>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {userRepos.map((repo) => {
                  const already = connectedRepos?.some((r) => r.githubId === repo.id);
                  return (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <div className="font-medium text-sm">{repo.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {repo.private ? "Private" : "Public"} · {repo.default_branch}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={already ? "secondary" : "default"}
                        disabled={already || connectRepo.isPending}
                        onClick={() => {
                          if (!workspace?.id) return;
                          connectRepo.mutate({
                            workspaceId: workspace.id,
                            githubId: repo.id,
                            fullName: repo.full_name,
                            defaultBranch: repo.default_branch,
                            private: repo.private,
                          });
                        }}
                      >
                        {already ? "Connected" : "Connect"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Connected Repos */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Connected Repositories</h2>
        {connectedRepos?.length === 0 ? (
          <Card className="p-8 text-center">
            <Github className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No repositories connected yet</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {connectedRepos?.map((repo) => (
              <Card
                key={repo.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedRepo === repo.id ? "border-primary ring-1 ring-primary" : ""}`}
                onClick={() => setSelectedRepo(repo.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{repo.fullName}</div>
                      <div className="text-sm text-muted-foreground">
                        {repo.private ? "Private" : "Public"} · {repo._count.pullRequests} PRs tracked
                      </div>
                    </div>
                    <Badge variant="outline">{repo.defaultBranch}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pull Requests */}
      {selectedRepo && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitPullRequest className="h-5 w-5" />
              Pull Requests
            </h2>
          </div>

          {loadingPRs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : prs?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No pull requests tracked yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {prs?.map((pr) => {
                const latestReview = pr.reviews[0];
                return (
                  <Card key={pr.id}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{pr.number}</span>
                          <span className="truncate">{pr.title}</span>
                          <Badge
                            variant="outline"
                            className={pr.state === "open" ? "text-green-600 border-green-500" : ""}
                          >
                            {pr.state}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {pr.headBranch} → {pr.baseBranch} · {relativeTime(pr.updatedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {latestReview && (
                          <Badge
                            variant="outline"
                            className={
                              latestReview.approved ? "text-green-600 border-green-500" : "text-red-600 border-red-500"
                            }
                          >
                            {latestReview.approved ? "✓ Approved" : "✗ Issues"}
                          </Badge>
                        )}
                        <Button size="sm" variant="outline" asChild>
                          <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="gap-1">
                            <ExternalLink className="h-3 w-3" /> GitHub
                          </a>
                        </Button>
                        {pr.featureId && (
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              triggerReview.mutate({ pullRequestId: pr.id, featureId: pr.featureId! })
                            }
                            disabled={triggerReview.isPending}
                          >
                            <Shield className="h-3 w-3" /> Review
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Webhook Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">GitHub Webhook Setup</CardTitle>
          <CardDescription>
            Configure your repository to automatically trigger AI reviews on pull request events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>Add a webhook to your GitHub repository with these settings:</p>
            <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
              <div><span className="text-muted-foreground">URL:</span> {process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/api/webhooks/github</div>
              <div><span className="text-muted-foreground">Content-Type:</span> application/json</div>
              <div><span className="text-muted-foreground">Events:</span> Pull requests</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
