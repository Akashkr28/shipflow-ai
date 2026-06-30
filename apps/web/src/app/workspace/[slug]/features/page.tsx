"use client";

import { useState } from "react";
import { Plus, Loader2, FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FEATURE_STATUS_COLORS, FEATURE_STATUS_LABELS, relativeTime } from "@/lib/utils";

export default function FeaturesPage() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [source, setSource] = useState<"MANUAL" | "EMAIL" | "SUPPORT_TICKET" | "SLACK">("MANUAL");

  const { data: workspace } = trpc.workspace.get.useQuery({ slug: params.slug });

  // Get all features across all projects in this workspace
  const { data: allFeatures, isLoading, refetch } = trpc.feature.listByWorkspace.useQuery(
    { workspaceId: workspace?.id ?? "", limit: 100 },
    { enabled: !!workspace?.id }
  );

  const createFeature = trpc.feature.create.useMutation({
    onSuccess: () => {
      toast({ title: "Feature request created!", description: "AI is analyzing your request..." });
      setOpen(false);
      setTitle("");
      setDescription("");
      refetch();
    },
    onError: () => toast({ title: "Failed to create feature", variant: "destructive" }),
  });

  const filtered = allFeatures?.filter(
    (f) =>
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.project.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            Feature Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your product features from idea to shipped
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Feature
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Feature Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Feature Title</Label>
                <Input
                  placeholder="e.g., Dark mode toggle for settings"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the feature request in detail. What problem does it solve? Who needs it?"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SUPPORT_TICKET">Support Ticket</SelectItem>
                    <SelectItem value="SLACK">Slack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project ID (optional)</Label>
                <Input
                  placeholder="Enter project ID"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave blank to create a default project</p>
              </div>
              <Button
                className="w-full"
                disabled={createFeature.isPending || !title.trim() || !description.trim()}
                onClick={async () => {
                  // Create or use existing project
                  let pid = projectId;
                  if (!pid && workspace?.id) {
                    const projects: Array<{ id: string }> = await fetch(
                      `/api/projects?workspaceId=${workspace.id}`
                    ).then((r) => r.json());

                    if (projects.length > 0) {
                      pid = projects[0].id;
                    } else {
                      const newProject = await fetch("/api/projects", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workspaceId: workspace.id, name: "Default Project" }),
                      }).then((r) => r.json());
                      pid = newProject.id;
                    }
                  }
                  if (!pid) {
                    toast({ title: "Please enter a project ID", variant: "destructive" });
                    return;
                  }
                  createFeature.mutate({ projectId: pid, title, description, source });
                }}
              >
                {createFeature.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Feature Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search features..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Feature List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">No features yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create your first feature request and let AI guide it to production
          </p>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Feature Request
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered?.map((feature) => (
            <Link
              key={feature.id}
              href={`/workspace/${params.slug}/features/${feature.id}`}
            >
              <Card className="hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{feature.title}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{feature.project.name}</span>
                      <span>·</span>
                      <span>{relativeTime(feature.updatedAt)}</span>
                      {feature._count.tasks > 0 && (
                        <>
                          <span>·</span>
                          <span>{feature._count.tasks} tasks</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge className={FEATURE_STATUS_COLORS[feature.status]}>
                    {FEATURE_STATUS_LABELS[feature.status]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
