import apiClient from "../../api/client";
import type { Interview, InterviewFilters, InterviewStatusAction, PaginatedInterviews } from "./types";

export async function listInterviews(filters: InterviewFilters = {}): Promise<PaginatedInterviews> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("page_size", String(filters.pageSize));
  if (filters.upcoming) params.set("upcoming", "true");
  if (filters.past) params.set("past", "true");
  if (filters.status) params.set("status", filters.status);
  const response = await apiClient.get<PaginatedInterviews>("/interviews/", { params });
  return response.data;
}

export async function getInterview(id: number): Promise<Interview> {
  const response = await apiClient.get<Interview>(`/interviews/${id}/`);
  return response.data;
}

export async function updateInterviewStatus(
  id: number,
  status: InterviewStatusAction,
  scheduledAt?: string,
): Promise<Interview> {
  const payload: { status: InterviewStatusAction; scheduled_at?: string } = { status };
  if (scheduledAt) payload.scheduled_at = scheduledAt;
  const response = await apiClient.post<Interview>(`/interviews/${id}/status/`, payload);
  return response.data;
}
