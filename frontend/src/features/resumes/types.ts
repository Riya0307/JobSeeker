export interface Resume {
  id: number;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  parsing_status: ResumeParsingStatus | null;
}

export type ResumeParsingStatus = "pending" | "processing" | "completed" | "failed";

export interface EmploymentEntry { title: string; company: string; date_range: string; is_current: boolean }
export interface SummaryEntry { summary?: string; name?: string }
export interface ParsedResumeData {
  status: ResumeParsingStatus;
  parser_version: string;
  skills: string[];
  job_titles: string[];
  companies: string[];
  employment_history: EmploymentEntry[];
  education: SummaryEntry[];
  projects: SummaryEntry[];
  certifications: SummaryEntry[];
  estimated_experience_months: number | null;
  estimated_experience_years: number | null;
  has_extracted_text: boolean;
  parsing_error: string;
  extracted_at: string | null;
  updated_at: string;
}

export interface ParsedDataSelection {
  apply_skills: boolean;
  apply_experience: boolean;
  apply_current_job: boolean;
}

export interface ResumeUpload {
  title: string;
  file: File;
}
