import { Link } from "react-router-dom";
import type { AuthUser } from "../../features/auth/types";
import type { CandidateProfile } from "../../features/profile/types";
import { calculateProfileCompletion } from "./completion";

export default function ProfileCompletion({ user, profile, resumeCount }: {
  user: AuthUser;
  profile: CandidateProfile;
  resumeCount: number;
}) {
  const { percentage, missing } = calculateProfileCompletion(user, profile, resumeCount);
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">Profile completion</h2>
        <span className="text-xl font-bold tabular-nums">{percentage}%</span>
      </div>
      <div className="ws-progress mt-2" role="progressbar" aria-label="Profile completion"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
        <div style={{ width: `${percentage}%` }} />
      </div>
      <p className="ws-muted mt-2 text-xs leading-relaxed">
        {missing.length ? `Missing ${missing.join(", ")}.` : "Your core candidate information is complete."}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
        <Link to="/profile" className="ws-link inline-flex min-h-9 items-center">Edit profile</Link>
        <Link to="/resumes" className="ws-link inline-flex min-h-9 items-center">
          {missing.includes("resume") ? "Add a resume" : "Manage resumes"}
        </Link>
      </div>
    </>
  );
}
