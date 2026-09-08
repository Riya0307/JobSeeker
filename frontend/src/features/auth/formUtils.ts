import axios from "axios";

function firstErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item);
      if (message) return message;
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const message = firstErrorMessage(item);
      if (message) return message;
    }
  }
  return null;
}

export function getApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Something went wrong. Please try again.";
  const message = firstErrorMessage(error.response?.data?.errors);
  if (message) return message;
  if (!error.response) return "Unable to reach the server. Please check your connection and try again.";
  if (error.response.status === 403) return "You are not authorized to perform this action.";
  if (error.response.status === 404) return "The requested record could not be found.";
  if (error.response.status === 429) return "Too many requests. Please wait and try again.";
  return "Unable to complete your request. Please try again.";
}

export const inputClass = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10";
export const buttonClass = "w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60";
