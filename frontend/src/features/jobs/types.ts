export type WorkMode = "onsite" | "hybrid" | "remote";

export interface Job {
  id: number;
  title: string;
  company_name: string;
  description: string;
  location: string;
  employment_type: string;
  work_mode: WorkMode;
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[];
  application_url: string;
  source: string;
  source_job_id: string;
  posted_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedJobs {
  count: number;
  next: string | null;
  previous: string | null;
  results: Job[];
}
