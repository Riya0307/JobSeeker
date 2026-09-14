import apiClient from "../../api/client";
import type {
  MarkAllReadResult,
  Notification,
  NotificationListParams,
  PaginatedNotifications,
} from "./types";

export async function listNotifications(
  options: NotificationListParams = {},
): Promise<PaginatedNotifications> {
  const response = await apiClient.get<PaginatedNotifications>("/notifications/", {
    params: {
      page: options.page,
      page_size: options.pageSize,
      unread: options.unread ? "true" : undefined,
    },
  });
  return response.data;
}

export async function getNotification(id: number): Promise<Notification> {
  const response = await apiClient.get<Notification>(`/notifications/${id}/`);
  return response.data;
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const response = await apiClient.post<Notification>(`/notifications/${id}/read/`);
  return response.data;
}

export async function markAllNotificationsRead(): Promise<MarkAllReadResult> {
  const response = await apiClient.post<MarkAllReadResult>("/notifications/read-all/");
  return response.data;
}
