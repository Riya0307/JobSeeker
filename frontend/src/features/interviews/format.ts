import type { InterviewMode, InterviewStatus } from "./types";

export function interviewStatusLabel(status: InterviewStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function interviewStatusClass(status: InterviewStatus) {
  if (status === "cancelled") return "border-red-400/20 bg-red-400/10 text-red-200";
  if (status === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "rescheduled") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
}

export function interviewModeLabel(mode: InterviewMode) {
  if (mode === "in_person") return "In person";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function formatInterviewDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date(value));
}

export function formatInterviewTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));
}

export function formatInterviewDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
