import apiClient from "../../api/client";
import type { CandidateProfile, CandidateProfileUpdate } from "./types";

interface ProfileResponse {
  data: CandidateProfile;
  message?: string;
}

export async function getProfile(): Promise<CandidateProfile> {
  const response = await apiClient.get<ProfileResponse>("/profile/");
  return response.data.data;
}

export async function updateProfile(payload: CandidateProfileUpdate): Promise<CandidateProfile> {
  const response = await apiClient.patch<ProfileResponse>("/profile/", payload);
  return response.data.data;
}
