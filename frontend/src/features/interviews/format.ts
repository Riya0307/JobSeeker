import type { InterviewMode, InterviewStatus } from "./types";

export function interviewStatusLabel(status: InterviewStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function interviewStatusTone(status: InterviewStatus) {
  if (status === "cancelled") return "error";
  if (status === "completed") return "success";
  if (status === "rescheduled") return "warning";
  return undefined;
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
