export type KnownNotificationType =
  | "application_submitted"
  | "application_withdrawn"
  | "interview_scheduled"
  | "interview_rescheduled"
  | "interview_cancelled"
  | "interview_completed";

export interface Notification {
  id: number;
  notification_type: KnownNotificationType | string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  application_id: number | null;
  interview_id: number | null;
}

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  unread?: boolean;
}

export interface MarkAllReadResult {
  updated_count: number;
}
