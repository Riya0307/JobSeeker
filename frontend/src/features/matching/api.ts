import apiClient from "../../api/client";
import type { JobMatch, MatchExplanationResponse, PaginatedJobMatches } from "./types";

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

export async function explainJobMatch(jobId: number): Promise<MatchExplanationResponse> {
  const response = await apiClient.post<MatchExplanationResponse>(`/matching/jobs/${jobId}/explanation/`);
  return response.data;
}
