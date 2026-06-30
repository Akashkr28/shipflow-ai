import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap, GitPullRequest, CheckSquare, Shield, ArrowRight,
  Bot, FileText, KanbanSquare, Star, Users, Rocket,
} from "lucide-react";

const WORKFLOW_STEPS = [
  { icon: FileText, label: "Feature Request", desc: "Submit via any channel", color: "text-blue-500" },
  { icon: Bot, label: "AI Clarification", desc: "AI gathers missing context", color: "text-purple-500" },
  { icon: FileText, label: "PRD Generation", desc: "Structured product docs", color: "text-violet-500" },
  { icon: KanbanSquare, label: "Task Planning", desc: "Engineering task breakdown", color: "text-amber-500" },
  { icon: GitPullRequest, label: "Development", desc: "Code implementation", color: "text-orange-500" },
  { icon: Shield, label: "AI Review", desc: "QA against requirements", color: "text-cyan-500" },
  { icon: CheckSquare, label: "Human Approval", desc: "Final reviewer sign-off", color: "text-green-500" },
  { icon: Rocket, label: "Ship It", desc: "Feature in production", color: "text-emerald-500" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "AI Requirements Clarification",
    description: "Our AI agent interviews requesters to fill gaps, detect duplicates, and validate feasibility before any work begins.",
  },
  {
    icon: FileText,
    title: "Structured PRD Generation",
    description: "Automatically generate comprehensive PRDs with problem statements, goals, user stories, acceptance criteria, and success metrics.",
  },
  {
    icon: KanbanSquare,
    title: "Smart Task Breakdown",
    description: "Convert PRDs into actionable engineering tasks organized on a Kanban board, ready for your team to pick up.",
  },
  {
    icon: GitPullRequest,
    title: "GitHub Integration",
    description: "Connect repositories, track pull requests, and trigger AI reviews automatically when code is pushed.",
  },
  {
    icon: Shield,
    title: "AI Code Review",
    description: "QA agent reviews PRs against PRD requirements, acceptance criteria, security, performance, and edge cases.",
  },
  {
    icon: CheckSquare,
    title: "Human Approval Gate",
    description: "Humans remain in control. Final approval gate ensures quality before any feature ships to production.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Nav */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ShipFlow AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          AI-Powered Product Delivery
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Feature to Production,<br />Intelligently.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          ShipFlow AI orchestrates your entire software delivery lifecycle — from fuzzy feature request to shipped
          production feature — with AI agents handling every step of the process.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/sign-up">
            <Button size="lg" className="gap-2">
              Start Building <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="#workflow">
            <Button size="lg" variant="outline">
              See How It Works
            </Button>
          </Link>
        </div>
        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>AI-powered reviews</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-blue-500" />
            <span>Multi-team workspaces</span>
          </div>
          <div className="flex items-center gap-1">
            <GitPullRequest className="h-4 w-4 text-green-500" />
            <span>GitHub native</span>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">The ShipFlow Loop</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every feature follows a structured, AI-assisted path from idea to production.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {WORKFLOW_STEPS.map((step, i) => (
            <Card key={i} className="text-center p-4">
              <CardContent className="pt-4 pb-2">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <step.icon className={`h-5 w-5 ${step.color}`} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-1">Step {i + 1}</div>
                <h3 className="font-semibold text-sm">{step.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything Your Team Needs</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A complete platform for modern product and engineering teams.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <Card key={i} className="p-6 hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <feature.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 text-center">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Ship Faster?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join teams using ShipFlow AI to deliver features from idea to production with confidence.
          </p>
          <Link href="/auth/sign-up">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex justify-between items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>ShipFlow AI</span>
          </div>
          <span>Built with Next.js, tRPC, and Claude AI</span>
        </div>
      </footer>
    </div>
  );
}
