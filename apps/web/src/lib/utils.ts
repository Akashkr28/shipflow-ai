import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function relativeTime(date: Date | string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diff = new Date(date).getTime() - Date.now();
  const seconds = Math.round(diff / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(seconds) < 60) return rtf.format(seconds, "second");
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}

export const FEATURE_STATUS_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  CLARIFYING: "Clarifying",
  READY_FOR_PRD: "Ready for PRD",
  GENERATING_PRD: "Generating PRD",
  PRD_READY: "PRD Ready",
  PLANNING: "Planning",
  TASKS_READY: "Tasks Ready",
  IN_DEVELOPMENT: "In Development",
  IN_REVIEW: "In Review",
  FIX_NEEDED: "Fix Needed",
  RE_REVIEWING: "Re-Reviewing",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SHIPPED: "Shipped",
  REJECTED: "Rejected",
  DUPLICATE: "Duplicate",
  NOT_NEEDED: "Not Needed",
};

export const FEATURE_STATUS_COLORS: Record<string, string> = {
  INTAKE: "bg-gray-100 text-gray-700",
  CLARIFYING: "bg-blue-100 text-blue-700",
  READY_FOR_PRD: "bg-indigo-100 text-indigo-700",
  GENERATING_PRD: "bg-purple-100 text-purple-700",
  PRD_READY: "bg-violet-100 text-violet-700",
  PLANNING: "bg-yellow-100 text-yellow-700",
  TASKS_READY: "bg-amber-100 text-amber-700",
  IN_DEVELOPMENT: "bg-orange-100 text-orange-700",
  IN_REVIEW: "bg-cyan-100 text-cyan-700",
  FIX_NEEDED: "bg-red-100 text-red-700",
  RE_REVIEWING: "bg-pink-100 text-pink-700",
  PENDING_APPROVAL: "bg-lime-100 text-lime-700",
  APPROVED: "bg-green-100 text-green-700",
  SHIPPED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-200 text-red-800",
  DUPLICATE: "bg-gray-200 text-gray-600",
  NOT_NEEDED: "bg-gray-200 text-gray-600",
};
