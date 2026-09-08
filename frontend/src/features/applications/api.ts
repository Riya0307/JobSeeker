import apiClient from "../../api/client";
import type { Application, CreateApplicationPayload, PaginatedApplications } from "./types";

export async function listApplications(page = 1, pageSize = 10): Promise<PaginatedApplications> {
  const response = await apiClient.get<PaginatedApplications>("/applications/", {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

export async function getApplication(id: number): Promise<Application> {
  const response = await apiClient.get<Application>(`/applications/${id}/`);
  return response.data;
}

export async function createApplication(payload: CreateApplicationPayload): Promise<Application> {
  const response = await apiClient.post<Application>("/applications/", payload);
  return response.data;
}

export async function withdrawApplication(id: number): Promise<Application> {
  const response = await apiClient.post<Application>(`/applications/${id}/withdraw/`);
  return response.data;
}

export async function findApplicationForJob(jobId: number): Promise<Application | null> {
  let page = 1;
  while (true) {
    const result = await listApplications(page, 100);
    const application = result.results.find((item) => item.job.id === jobId);
    if (application) return application;
    if (!result.next) return null;
    page += 1;
  }
}
