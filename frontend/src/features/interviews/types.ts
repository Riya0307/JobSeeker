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
