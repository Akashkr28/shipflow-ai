"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: workspaces, isLoading, refetch } = trpc.workspace.list.useQuery();
  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: (workspace) => {
      setOpen(false);
      refetch();
      router.push(`/workspace/${workspace.slug}`);
    },
  });

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
      <div className="container py-16">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">ShipFlow AI</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Your Workspaces</h1>
        <p className="text-muted-foreground mb-8">Select a workspace to continue, or create a new one.</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {workspaces?.map((m) => (
            <Link key={m.workspace.id} href={`/workspace/${m.workspace.slug}`}>
              <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{m.workspace.name}</CardTitle>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </div>
                  <CardDescription>
                    <span className="capitalize">{m.role.toLowerCase()}</span> · {m.workspace.plan} plan
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Plus className="h-8 w-8 mb-2" />
                  <span className="font-medium">New Workspace</span>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input
                    placeholder="Acme Corp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createWorkspace.mutate({ name })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createWorkspace.mutate({ name })}
                  disabled={createWorkspace.isPending || !name.trim()}
                >
                  {createWorkspace.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Workspace
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
