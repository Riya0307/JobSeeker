export interface CandidateProfile {
  phone: string;
  location: string;
  headline: string;
  bio: string;
  years_of_experience: number;
  current_job_title: string;
  current_company: string;
  skills: string[];
  created_at: string;
  updated_at: string;
}

export type CandidateProfileUpdate = Omit<CandidateProfile, "created_at" | "updated_at">;
