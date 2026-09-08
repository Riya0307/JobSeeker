import type { ApplicationStatus } from "./types";

export function applicationStatusLabel(status: ApplicationStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function applicationStatusClass(status: ApplicationStatus) {
  if (status === "withdrawn" || status === "rejected") return "border-red-400/20 bg-red-400/10 text-red-200";
  if (status === "shortlisted" || status === "interview") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "under_review") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
