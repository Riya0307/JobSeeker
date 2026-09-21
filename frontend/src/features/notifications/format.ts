import type { Notification } from "./types";

const applicationTypes = new Set(["application_submitted", "application_withdrawn"]);
const interviewTypes = new Set([
  "interview_scheduled",
  "interview_rescheduled",
  "interview_cancelled",
  "interview_completed",
]);

export function notificationPath(notification: Notification): string | null {
  if (applicationTypes.has(notification.notification_type) && notification.application_id) {
    return `/applications/${notification.application_id}`;
  }
  if (interviewTypes.has(notification.notification_type) && notification.interview_id) {
    return `/interviews/${notification.interview_id}`;
  }
  if (notification.notification_type === "job_alert_match" && notification.job_id) {
    return `/jobs/${notification.job_id}`;
  }
  return null;
}

export function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absoluteSeconds < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return formatter.format(days, "day");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
