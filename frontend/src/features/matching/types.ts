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

export interface MatchSkillGap {
  skill: string;
  importance: "low" | "medium" | "high";
  explanation: string;
}

export interface MatchExplanation {
  summary: string;
  strengths: string[];
  skill_gaps: MatchSkillGap[];
  experience_alignment: string;
  application_tips: string[];
  considerations: string[];
}

export interface MatchExplanationResponse {
  status: "generated" | "cached" | "processing" | "unavailable";
  explanation: MatchExplanation | null;
  detail: string;
}
