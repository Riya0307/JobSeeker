import apiClient from "../../api/client";
import type { Resume, ResumeUpload } from "./types";

export async function listResumes(): Promise<Resume[]> {
  const response = await apiClient.get<Resume[]>("/resumes/");
  return response.data;
}

export async function getResume(id: number): Promise<Resume> {
  const response = await apiClient.get<Resume>(`/resumes/${id}/`);
  return response.data;
}

export async function uploadResume(payload: ResumeUpload): Promise<Resume> {
  const form = new FormData();
  form.append("title", payload.title);
  form.append("file", payload.file);
  const response = await apiClient.post<Resume>("/resumes/", form);
  return response.data;
}

export async function updateResumeTitle(id: number, title: string): Promise<Resume> {
  const response = await apiClient.patch<Resume>(`/resumes/${id}/`, { title });
  return response.data;
}

export async function setPrimaryResume(id: number): Promise<Resume> {
  const response = await apiClient.post<Resume>(`/resumes/${id}/set-primary/`);
  return response.data;
}

export async function deleteResume(id: number): Promise<void> {
  await apiClient.delete(`/resumes/${id}/`);
}
