"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, LayoutDashboard, FolderKanban, GitPullRequest,
  Settings, CreditCard, Bell, Users, ChevronDown, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { useSession, signOut } from "@/lib/auth-client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  workspaceSlug: string;
}

const getNavItems = (slug: string) => [
  { href: `/workspace/${slug}`, icon: LayoutDashboard, label: "Dashboard" },
  { href: `/workspace/${slug}/features`, icon: FolderKanban, label: "Features" },
  { href: `/workspace/${slug}/github`, icon: GitPullRequest, label: "GitHub & Reviews" },
  { href: `/workspace/${slug}/members`, icon: Users, label: "Members" },
  { href: `/workspace/${slug}/billing`, icon: CreditCard, label: "Billing" },
  { href: `/workspace/${slug}/settings`, icon: Settings, label: "Settings" },
];

export function Sidebar({ workspaceSlug }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: workspaces } = trpc.workspace.list.useQuery();
  const navItems = getNavItems(workspaceSlug);

  return (
    <div className="flex flex-col h-full w-64 border-r bg-background">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg">ShipFlow AI</span>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between font-medium">
              <span className="truncate">{workspaceSlug}</span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {workspaces?.map((m) => (
              <DropdownMenuItem key={m.workspace.id} asChild>
                <Link href={`/workspace/${m.workspace.slug}`}>{m.workspace.name}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="gap-2">
                <Plus className="h-4 w-4" /> New Workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== `/workspace/${workspaceSlug}` && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={session?.user?.image ?? ""} />
                <AvatarFallback className="text-xs">
                  {session?.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <div className="text-sm font-medium truncate">{session?.user?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{session?.user?.email}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/dashboard">Switch Workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
