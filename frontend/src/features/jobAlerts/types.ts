import type { WorkMode } from "../jobs/types";

export type EmploymentType = "full-time" | "part-time" | "contract" | "internship" | "temporary";

export interface JobAlert {
  id: number;
  name: string;
  keywords: string;
  location: string;
  work_mode: WorkMode | "";
  employment_type: EmploymentType | "";
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
}

export interface PaginatedJobAlerts {
  count: number;
  next: string | null;
  previous: string | null;
  results: JobAlert[];
}

export interface JobAlertPayload {
  name?: string;
  keywords?: string;
  location?: string;
  work_mode?: WorkMode | "";
  employment_type?: EmploymentType | "";
  experience_min?: number | null;
  experience_max?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  skills?: string[];
}
