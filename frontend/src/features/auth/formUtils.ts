import axios from "axios";

export function getApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Something went wrong. Please try again.";
  const errors = error.response?.data?.errors;
  if (!errors) return "Unable to complete your request. Please try again.";
  const first = Object.values(errors)[0];
  return Array.isArray(first) ? String(first[0]) : String(first);
}

export const inputClass = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10";
export const buttonClass = "w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60";
