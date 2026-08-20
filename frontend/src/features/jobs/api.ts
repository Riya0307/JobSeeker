import apiClient from "../../api/client";
import type { Job, PaginatedJobs } from "./types";

export async function listJobs(params: URLSearchParams): Promise<PaginatedJobs> {
  const response = await apiClient.get<PaginatedJobs>("/jobs/", { params });
  return response.data;
}

export async function getJob(id: number): Promise<Job> {
  const response = await apiClient.get<Job>(`/jobs/${id}/`);
  return response.data;
}

export async function listSavedJobs(page: number): Promise<PaginatedJobs> {
  const response = await apiClient.get<PaginatedJobs>("/jobs/saved/", { params: { page } });
  return response.data;
}

export async function saveJob(id: number): Promise<Job> {
  const response = await apiClient.post<Job>(`/jobs/${id}/save/`);
  return response.data;
}

export async function unsaveJob(id: number): Promise<void> {
  await apiClient.delete(`/jobs/${id}/save/`);
}
