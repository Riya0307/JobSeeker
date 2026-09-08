import apiClient from "../../api/client";
import type { JobMatch, PaginatedJobMatches } from "./types";

export async function listJobMatches(page: number, pageSize?: number): Promise<PaginatedJobMatches> {
  const response = await apiClient.get<PaginatedJobMatches>("/matching/jobs/", {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

export async function getJobMatch(jobId: number): Promise<JobMatch> {
  const response = await apiClient.get<JobMatch>(`/matching/jobs/${jobId}/`);
  return response.data;
}
