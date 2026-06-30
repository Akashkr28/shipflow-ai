"use client";

import { useState } from "react";
import { Users, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "next/navigation";
import { formatDate } from "@/lib/utils";

export default function MembersPage() {
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");

  const { data: workspace } = trpc.workspace.get.useQuery({ slug: params.slug });
  const { data: members, refetch } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: !!workspace?.id }
  );

  const invite = trpc.workspace.invite.useMutation({
    onSuccess: () => {
      toast({ title: "Member invited!" });
      setOpen(false);
      setEmail("");
      refetch();
    },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const ROLE_COLORS: Record<string, string> = {
    OWNER: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    MEMBER: "bg-gray-100 text-gray-700",
    VIEWER: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Members
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {members?.length ?? 0} member{members?.length !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin — can manage workspace</SelectItem>
                    <SelectItem value="MEMBER">Member — can create and edit</SelectItem>
                    <SelectItem value="VIEWER">Viewer — read only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() =>
                  workspace?.id && invite.mutate({ workspaceId: workspace.id, email, role })
                }
                disabled={invite.isPending || !email.trim()}
              >
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {members?.map((member) => (
          <Card key={member.id}>
            <CardContent className="py-4 flex items-center gap-4">
              <Avatar>
                <AvatarImage src={member.user.image ?? ""} />
                <AvatarFallback>
                  {member.user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{member.user.name}</div>
                <div className="text-sm text-muted-foreground">{member.user.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={ROLE_COLORS[member.role]}>{member.role}</Badge>
                <span className="text-sm text-muted-foreground">Joined {formatDate(member.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
