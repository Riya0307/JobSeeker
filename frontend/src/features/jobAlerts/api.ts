import apiClient from "../../api/client";
import type { JobAlert, JobAlertPayload, PaginatedJobAlerts } from "./types";

export async function listJobAlerts(page = 1): Promise<PaginatedJobAlerts> {
  const response = await apiClient.get<PaginatedJobAlerts>("/job-alerts/", { params: { page } });
  return response.data;
}

export async function getJobAlert(id: number): Promise<JobAlert> {
  const response = await apiClient.get<JobAlert>(`/job-alerts/${id}/`);
  return response.data;
}

export async function createJobAlert(payload: JobAlertPayload): Promise<JobAlert> {
  const response = await apiClient.post<JobAlert>("/job-alerts/", payload);
  return response.data;
}

export async function updateJobAlert(id: number, payload: JobAlertPayload): Promise<JobAlert> {
  const response = await apiClient.patch<JobAlert>(`/job-alerts/${id}/`, payload);
  return response.data;
}

export async function deleteJobAlert(id: number): Promise<void> {
  await apiClient.delete(`/job-alerts/${id}/`);
}

export async function toggleJobAlert(id: number): Promise<JobAlert> {
  const response = await apiClient.post<JobAlert>(`/job-alerts/${id}/toggle/`);
  return response.data;
}
