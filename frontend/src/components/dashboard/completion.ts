import type { AuthUser } from "../../features/auth/types";
import type { CandidateProfile } from "../../features/profile/types";

export interface ProfileCompletionResult {
  percentage: number;
  missing: string[];
}

export function calculateProfileCompletion(
  user: AuthUser,
  profile: CandidateProfile,
  resumeCount: number,
): ProfileCompletionResult {
  const checks: Array<[string, boolean]> = [
    ["name", Boolean(user.first_name.trim() || user.last_name.trim())],
    ["email", Boolean(user.email.trim())],
    ["phone", Boolean(profile.phone.trim())],
    ["location", Boolean(profile.location.trim())],
    ["headline", Boolean(profile.headline.trim())],
    ["bio", Boolean(profile.bio.trim())],
    ["current role", Boolean(profile.current_job_title.trim())],
    ["current company", Boolean(profile.current_company.trim())],
    // Zero is a valid value for an entry-level candidate, not missing data.
    ["experience", Number.isFinite(profile.years_of_experience) && profile.years_of_experience >= 0],
    ["skills", profile.skills.length > 0],
    ["resume", resumeCount > 0],
  ];
  const complete = checks.filter(([, present]) => present).length;
  return {
    percentage: Math.round((complete / checks.length) * 100),
    missing: checks.filter(([, present]) => !present).map(([label]) => label),
  };
}
