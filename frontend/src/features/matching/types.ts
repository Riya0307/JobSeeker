import type { Job } from "../jobs/types";

export interface JobMatch {
  job: Job;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  reasons: string[];
}

export interface PaginatedJobMatches {
  count: number;
  next: string | null;
  previous: string | null;
  results: JobMatch[];
}
