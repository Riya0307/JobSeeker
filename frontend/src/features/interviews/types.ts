import type { ApplicationJob } from "../applications/types";

export type InterviewMode = "online" | "phone" | "in_person";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";
export type InterviewStatusAction = Exclude<InterviewStatus, "scheduled">;

export interface InterviewApplication {
  id: number;
  job: ApplicationJob;
}

export interface Interview {
  id: number;
  application: InterviewApplication;
  round_name: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: InterviewMode;
  meeting_link: string;
  location: string;
  notes: string;
  status: InterviewStatus;
  created_at: string;
  updated_at: string;
}

export interface PaginatedInterviews {
  count: number;
  next: string | null;
  previous: string | null;
  results: Interview[];
}

export interface InterviewFilters {
  page?: number;
  pageSize?: number;
  upcoming?: boolean;
  past?: boolean;
  status?: InterviewStatus;
}
export interface InterviewPreparation {
  overview: string;
  technical_topics: { topic: string; reason: string; priority: "high" | "medium" | "low" }[];
  technical_questions: { question: string; what_interviewer_assesses: string; preparation_guidance: string }[];
  behavioral_questions: { question: string; guidance: string }[];
  profile_gaps: { area: string; guidance: string }[];
  questions_to_ask: string[];
  preparation_checklist: string[];
}

export type InterviewPreparationResponse =
  | { status: "generated"; preparation: InterviewPreparation; detail: string }
  | { status: "processing" | "unavailable"; preparation: null; detail: string };
