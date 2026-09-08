import type { WorkMode } from "../jobs/types";

export type ApplicationStatus =
  | "applied"
  | "under_review"
  | "shortlisted"
  | "interview"
  | "rejected"
  | "withdrawn";

export interface ApplicationJob {
  id: number;
  title: string;
  company_name: string;
  location: string;
  work_mode: WorkMode;
  employment_type: string;
}

export interface ApplicationResume {
  id: number;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_primary: boolean;
}

export interface Application {
  id: number;
  status: ApplicationStatus;
  job: ApplicationJob;
  resume: ApplicationResume;
  cover_letter: string;
  applied_at: string;
  updated_at: string;
  withdrawn_at: string | null;
}

export interface PaginatedApplications {
  count: number;
  next: string | null;
  previous: string | null;
  results: Application[];
}

export interface CreateApplicationPayload {
  job_id: number;
  resume_id?: number;
  cover_letter?: string;
}
