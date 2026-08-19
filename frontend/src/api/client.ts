import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const ACCESS_TOKEN_KEY = "jobseeker.accessToken";
const REFRESH_TOKEN_KEY = "jobseeker.refreshToken";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccess();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshRequest: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isAuthRequest = /\/auth\/(login|register|token\/refresh)\//.test(request?.url ?? "");
    const refreshToken = tokenStorage.getRefresh();

    if (error.response?.status !== 401 || request?._retry || isAuthRequest || !refreshToken) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      refreshRequest ??= axios
        .post(`${apiBaseUrl}/auth/token/refresh/`, { refresh: refreshToken })
        .then((response) => {
          const access = response.data.data.access as string;
          tokenStorage.set(access);
          return access;
        })
        .finally(() => {
          refreshRequest = null;
        });
      const access = await refreshRequest;
      request.headers.Authorization = `Bearer ${access}`;
      return apiClient(request);
    } catch (refreshError) {
      tokenStorage.clear();
      window.dispatchEvent(new Event("auth:expired"));
      if (window.location.pathname !== "/login") window.location.assign("/login");
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
