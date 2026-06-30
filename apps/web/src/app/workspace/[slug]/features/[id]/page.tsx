"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Loader2, ArrowLeft, Send, Bot, FileText, KanbanSquare,
  GitPullRequest, Shield, CheckCircle2, XCircle, AlertTriangle,
  Rocket, ChevronRight, RefreshCw, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { FEATURE_STATUS_COLORS, FEATURE_STATUS_LABELS, formatDate, relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default function FeatureDetailPage() {
  const params = useParams<{ slug: string; id: string }>();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  const { data: feature, isLoading, refetch } = trpc.feature.get.useQuery({ id: params.id });
  const { data: reviews } = trpc.review.listByFeature.useQuery({ featureId: params.id });

  const sendMessage = trpc.feature.sendMessage.useMutation({
    onSuccess: () => { setMessage(""); refetch(); },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const generatePRD = trpc.feature.generatePRD.useMutation({
    onSuccess: () => { toast({ title: "Generating PRD...", description: "This may take a moment" }); refetch(); },
  });

  const generateTasks = trpc.feature.generateTasks.useMutation({
    onSuccess: () => { toast({ title: "Generating tasks..." }); refetch(); },
  });

  const approve = trpc.feature.approve.useMutation({
    onSuccess: () => { toast({ title: "Decision recorded!" }); refetch(); },
  });

  const ship = trpc.feature.ship.useMutation({
    onSuccess: () => { toast({ title: "🚀 Feature shipped!" }); refetch(); },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!feature) return <div className="p-8">Feature not found</div>;

  const latestReview = reviews?.[0];
  const blockingIssues = (latestReview?.comments ?? []).filter((c) => c.severity === "BLOCKING");
  const nonBlockingIssues = (latestReview?.comments ?? []).filter((c) => c.severity === "NON_BLOCKING");

  const canGeneratePRD =
    ["READY_FOR_PRD", "PRD_READY", "CLARIFYING", "INTAKE"].includes(feature.status) ||
    (feature.status === "GENERATING_PRD" && !feature.prd);
  const canGenerateTasks = !!feature.prd && ["PRD_READY", "TASKS_READY", "PLANNING"].includes(feature.status);
  const canApprove = feature.status === "PENDING_APPROVAL";
  const canShip = feature.status === "APPROVED";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/workspace/${params.slug}/features`} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Features
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1">{feature.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Created {formatDate(feature.createdAt)}</span>
              <span>·</span>
              <span>Source: {feature.source}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn("text-sm px-3 py-1", FEATURE_STATUS_COLORS[feature.status])}>
              {FEATURE_STATUS_LABELS[feature.status]}
            </Badge>
            {canShip && (
              <Button
                className="gap-2"
                onClick={() => ship.mutate({ featureId: feature.id })}
                disabled={ship.isPending}
              >
                <Rocket className="h-4 w-4" />
                {ship.isPending ? "Shipping..." : "Ship Feature"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Progress */}
      <WorkflowProgress status={feature.status} />

      {/* Action Bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {canGeneratePRD && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => generatePRD.mutate({ featureId: feature.id })}
            disabled={generatePRD.isPending}
          >
            <FileText className="h-4 w-4" />
            {generatePRD.isPending ? "Generating..." : "Generate PRD"}
          </Button>
        )}
        {canGenerateTasks && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => generateTasks.mutate({ featureId: feature.id })}
            disabled={generateTasks.isPending}
          >
            <KanbanSquare className="h-4 w-4" />
            {generateTasks.isPending ? "Generating..." : "Generate Tasks"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="discovery" className="w-full">
        <TabsList>
          <TabsTrigger value="discovery" className="gap-1">
            <Bot className="h-4 w-4" /> Discovery
          </TabsTrigger>
          <TabsTrigger value="prd" className="gap-1" disabled={!feature.prd}>
            <FileText className="h-4 w-4" /> PRD
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1" disabled={feature.tasks.length === 0}>
            <KanbanSquare className="h-4 w-4" /> Tasks ({feature.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1">
            <Shield className="h-4 w-4" /> Reviews ({reviews?.length ?? 0})
          </TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approval" className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Approval
            </TabsTrigger>
          )}
        </TabsList>

        {/* Discovery Tab */}
        <TabsContent value="discovery">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-4">
                {/* Original Request */}
                <div className="mb-4 p-4 bg-secondary/30 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">ORIGINAL REQUEST</div>
                  <p className="text-sm">{feature.description}</p>
                </div>

                {/* Conversation */}
                <div className="space-y-3">
                  {feature.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-3 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>

                {feature.status === "CLARIFYING" && (
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI is thinking...
                  </div>
                )}
              </ScrollArea>

              {["INTAKE", "CLARIFYING", "READY_FOR_PRD"].includes(feature.status) && (
                <div className="border-t p-4 flex gap-2">
                  <Textarea
                    placeholder="Provide more context or answer AI's questions..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (message.trim()) sendMessage.mutate({ featureId: feature.id, content: message });
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    disabled={!message.trim() || sendMessage.isPending}
                    onClick={() => sendMessage.mutate({ featureId: feature.id, content: message })}
                  >
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRD Tab */}
        <TabsContent value="prd">
          {feature.prd ? (
            <PRDView prd={feature.prd} />
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">PRD not yet generated</p>
            </Card>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <TasksView tasks={feature.tasks} featureId={feature.id} refetch={refetch} />
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <ReviewsView
            reviews={reviews ?? []}
            featureId={feature.id}
            featureStatus={feature.status}
            refetch={refetch}
          />
        </TabsContent>

        {/* Approval Tab */}
        {canApprove && (
          <TabsContent value="approval">
            <ApprovalView
              feature={feature}
              prd={feature.prd}
              tasks={feature.tasks}
              reviews={reviews ?? []}
              notes={approvalNotes}
              onNotesChange={setApprovalNotes}
              onApprove={() =>
                approve.mutate({ featureId: feature.id, decision: "APPROVED", notes: approvalNotes })
              }
              onReject={() =>
                approve.mutate({ featureId: feature.id, decision: "REJECTED", notes: approvalNotes })
              }
              isLoading={approve.isPending}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function WorkflowProgress({ status }: { status: string }) {
  const steps = [
    { key: ["INTAKE", "CLARIFYING", "READY_FOR_PRD"], label: "Discovery" },
    { key: ["GENERATING_PRD", "PRD_READY"], label: "PRD" },
    { key: ["PLANNING", "TASKS_READY"], label: "Planning" },
    { key: ["IN_DEVELOPMENT"], label: "Development" },
    { key: ["IN_REVIEW", "FIX_NEEDED", "RE_REVIEWING"], label: "Review" },
    { key: ["PENDING_APPROVAL", "APPROVED"], label: "Approval" },
    { key: ["SHIPPED"], label: "Shipped" },
  ];

  const currentIdx = steps.findIndex((s) => s.key.includes(status));

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
              i < currentIdx
                ? "bg-primary text-primary-foreground"
                : i === currentIdx
                ? "bg-primary/20 text-primary border border-primary"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {step.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function PRDView({ prd }: { prd: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Problem Statement</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{prd.problemStatement as string}</p>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Goals</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {(prd.goals as string[])?.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  {g}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Non-Goals</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {(prd.nonGoals as string[])?.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  {g}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">User Stories</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(prd.userStories as Array<{ as: string; iWant: string; soThat: string }>)?.map((s, i) => (
              <div key={i} className="text-sm p-3 bg-secondary/30 rounded-md">
                <span className="font-medium">As a</span> {s.as},{" "}
                <span className="font-medium">I want</span> {s.iWant},{" "}
                <span className="font-medium">so that</span> {s.soThat}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Acceptance Criteria</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1">
            {(prd.acceptanceCriteria as string[])?.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-mono text-xs text-muted-foreground mt-0.5">{i + 1}.</span>
                {c}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Edge Cases</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {(prd.edgeCases as string[])?.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  {e}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Success Metrics</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(prd.successMetrics as Array<{ metric: string; target: string; measurement: string }>)?.map((m, i) => (
                <div key={i} className="text-sm">
                  <div className="font-medium">{m.metric}</div>
                  <div className="text-muted-foreground">Target: {m.target} · {m.measurement}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TasksView({
  tasks,
  featureId,
  refetch,
}: {
  tasks: Array<{ id: string; title: string; description: string; status: string; priority: string }>;
  featureId: string;
  refetch: () => void;
}) {
  const updateTask = trpc.task.update.useMutation({ onSuccess: refetch });
  const columns = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {columns.map((col) => (
        <div key={col} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {col.replace("_", " ")}
            <span className="ml-1 text-muted-foreground">
              ({tasks.filter((t) => t.status === col).length})
            </span>
          </div>
          {tasks
            .filter((t) => t.status === col)
            .map((task) => (
              <Card key={task.id} className="p-3">
                <div className="text-sm font-medium mb-1">{task.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</div>
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      task.priority === "CRITICAL" && "border-red-500 text-red-600",
                      task.priority === "HIGH" && "border-orange-500 text-orange-600",
                      task.priority === "MEDIUM" && "border-blue-500 text-blue-600",
                      task.priority === "LOW" && "border-gray-400 text-gray-600"
                    )}
                  >
                    {task.priority}
                  </Badge>
                  <select
                    className="text-xs border rounded px-1 py-0.5 bg-background"
                    value={task.status}
                    onChange={(e) =>
                      updateTask.mutate({ id: task.id, status: e.target.value as "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" })
                    }
                  >
                    {columns.map((c) => (
                      <option key={c} value={c}>{c.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </Card>
            ))}
        </div>
      ))}
    </div>
  );
}

function ReviewsView({
  reviews,
  featureId,
  featureStatus,
  refetch,
}: {
  reviews: Array<{
    id: string;
    status: string;
    summary: string | null;
    score: number | null;
    approved: boolean;
    createdAt: Date;
    pullRequest: { title: string; number: number; htmlUrl: string };
    comments: Array<{ id: string; severity: string; category: string | null; body: string; file: string | null }>;
    _count: { comments: number };
  }>;
  featureId: string;
  featureStatus: string;
  refetch: () => void;
}) {
  const triggerReview = trpc.review.triggerReReview.useMutation({
    onSuccess: () => refetch(),
  });

  if (reviews.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No reviews yet. Link a PR to trigger AI review.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {review.approved ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  PR #{review.pullRequest.number}: {review.pullRequest.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{relativeTime(review.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                {review.score !== null && (
                  <div className="text-center">
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        review.score >= 80 ? "text-green-600" : review.score >= 60 ? "text-amber-600" : "text-red-600"
                      )}
                    >
                      {review.score}
                    </div>
                    <div className="text-xs text-muted-foreground">/ 100</div>
                  </div>
                )}
                {featureStatus === "FIX_NEEDED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() =>
                      triggerReview.mutate({ pullRequestId: review.pullRequest.title, featureId })
                    }
                  >
                    <RefreshCw className="h-4 w-4" /> Re-review
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {review.summary && (
              <p className="text-sm text-muted-foreground mb-4">{review.summary}</p>
            )}
            {review.comments.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Issues ({review._count.comments})</div>
                {review.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      "p-3 rounded-md border text-sm",
                      comment.severity === "BLOCKING" && "border-red-200 bg-red-50",
                      comment.severity === "NON_BLOCKING" && "border-amber-200 bg-amber-50",
                      comment.severity === "SUGGESTION" && "border-blue-200 bg-blue-50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          comment.severity === "BLOCKING" && "border-red-500 text-red-600",
                          comment.severity === "NON_BLOCKING" && "border-amber-500 text-amber-600",
                          comment.severity === "SUGGESTION" && "border-blue-500 text-blue-600"
                        )}
                      >
                        {comment.severity}
                      </Badge>
                      {comment.category && (
                        <span className="text-xs text-muted-foreground">{comment.category}</span>
                      )}
                      {comment.file && (
                        <span className="text-xs font-mono text-muted-foreground">{comment.file}</span>
                      )}
                    </div>
                    <p>{comment.body}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ApprovalView({
  feature,
  prd,
  tasks,
  reviews,
  notes,
  onNotesChange,
  onApprove,
  onReject,
  isLoading,
}: {
  feature: { title: string; description: string; approvals: Array<{ decision: string; user: { name: string }; notes: string | null; createdAt: Date }> };
  prd: unknown;
  tasks: Array<{ status: string }>;
  reviews: Array<{ score: number | null; approved: boolean }>;
  notes: string;
  onNotesChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  const latestReview = reviews[0];
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Release Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <ChecklistItem done={!!prd} label="PRD generated and reviewed" />
            <ChecklistItem done={tasks.length > 0} label={`${tasks.length} engineering tasks created`} />
            <ChecklistItem
              done={completedTasks > 0}
              label={`${completedTasks}/${tasks.length} tasks completed`}
            />
            <ChecklistItem
              done={reviews.length > 0}
              label={`${reviews.length} AI review(s) completed`}
            />
            <ChecklistItem
              done={!!latestReview?.approved}
              label={`AI review score: ${latestReview?.score ?? "N/A"}/100`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Human Approval</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Add approval notes (optional)..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              onClick={onApprove}
              disabled={isLoading}
            >
              <ThumbsUp className="h-4 w-4" />
              {isLoading ? "Processing..." : "Approve & Prepare to Ship"}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={onReject}
              disabled={isLoading}
            >
              <ThumbsDown className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>

      {feature.approvals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feature.approvals.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{a.user.name}</span>
                    {a.notes && <span className="text-muted-foreground ml-2">· {a.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        a.decision === "APPROVED" ? "text-green-600 border-green-500" : "text-red-600 border-red-500"
                      }
                    >
                      {a.decision}
                    </Badge>
                    <span className="text-muted-foreground">{relativeTime(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
      )}
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
