import { Link } from "react-router-dom";
import type { AuthUser } from "../../features/auth/types";
import type { CandidateProfile } from "../../features/profile/types";
import { calculateProfileCompletion } from "./completion";

interface ProfileCompletionProps {
  user: AuthUser;
  profile: CandidateProfile;
  resumeCount: number | null;
}

export default function ProfileCompletion({ user, profile, resumeCount }: ProfileCompletionProps) {
  if (resumeCount === null) return <div className="h-40 animate-pulse rounded-xl bg-white/5" aria-label="Loading profile completion" />;
  const completion = calculateProfileCompletion(user, profile, resumeCount);
  return (
    <div>
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm text-slate-400">Profile completeness</p><p className="mt-1 text-3xl font-semibold">{completion.percentage}%</p></div><span className="text-sm text-slate-500">{completion.missing.length ? `${completion.missing.length} areas left` : "Complete"}</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion.percentage}><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${completion.percentage}%` }} /></div>
      {completion.missing.length ? <p className="mt-4 text-sm leading-6 text-slate-400">Add {completion.missing.slice(0, 3).join(", ")}{completion.missing.length > 3 ? ", and more" : ""} to strengthen your profile.</p> : <p className="mt-4 text-sm text-emerald-300">Your core candidate information is complete.</p>}
      <div className="mt-5 flex flex-wrap gap-3"><Link to="/profile" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Edit profile</Link><Link to="/resumes" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300">Manage resumes</Link></div>
    </div>
  );
}
