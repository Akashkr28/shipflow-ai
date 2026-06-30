import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@shipflow/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, name, description } = await req.json();

  const project = await prisma.project.create({
    data: { workspaceId, name, description },
  });

  return NextResponse.json(project);
}
