import apiClient from "./client";

export interface HealthResponse {
  status: string;
  service: string;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>("/health/");
  return response.data;
}
