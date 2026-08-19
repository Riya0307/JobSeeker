import apiClient from "../../api/client";
import type { AuthPayload, AuthResult, AuthUser, RegistrationPayload } from "./types";

export async function register(payload: RegistrationPayload): Promise<AuthResult> {
  const response = await apiClient.post<{ data: AuthResult }>("/auth/register/", payload);
  return response.data.data;
}

export async function login(payload: AuthPayload): Promise<AuthResult> {
  const response = await apiClient.post<{ data: AuthResult }>("/auth/login/", payload);
  return response.data.data;
}

export async function loadCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<{ data: AuthUser }>("/auth/me/");
  return response.data.data;
}

export async function logout(refresh: string): Promise<void> {
  await apiClient.post("/auth/logout/", { refresh });
}
