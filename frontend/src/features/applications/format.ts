import type { ApplicationStatus } from "./types";

export function applicationStatusLabel(status: ApplicationStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function applicationStatusTone(status: ApplicationStatus) {
  if (status === "withdrawn") return "neutral";
  if (status === "rejected") return "error";
  if (status === "shortlisted" || status === "interview") return "success";
  if (status === "under_review") return "warning";
  return undefined;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
