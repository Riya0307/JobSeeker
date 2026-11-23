import { useId } from "react";

interface MatchReasonsProps {
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export default function MatchReasons({ matchedSkills, missingSkills, reasons }: MatchReasonsProps) {
  const id = useId();
  return (
    <div className="ws-divider mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
      {[
        { key: "matched", title: "Matched skills", skills: matchedSkills, tone: "success", empty: "No required skills matched yet." },
        { key: "missing", title: "Missing skills", skills: missingSkills, tone: "warning", empty: "No missing skills reported." },
      ].map(({ key, title, skills, tone, empty }) => (
        <section key={key} className="min-w-0" aria-labelledby={`${id}-${key}`}>
          <h3 id={`${id}-${key}`} className="text-sm font-semibold">{title} ({skills.length})</h3>
          {skills.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill) => <li key={skill} className="ws-badge max-w-full wrap-anywhere" data-tone={tone}>{skill}</li>)}
            </ul>
          ) : <p className="ws-muted mt-1 text-sm">{empty}</p>}
        </section>
      ))}
      <section className="min-w-0 sm:col-span-2" aria-labelledby={`${id}-reasons`}>
        <h3 id={`${id}-reasons`} className="text-sm font-semibold">Why this matches</h3>
        {reasons.length ? (
          <ul className="ws-muted mt-2 list-disc space-y-1 pl-5 text-sm">
            {reasons.map((reason, index) => <li key={`${reason}-${index}`} className="wrap-anywhere">{reason}</li>)}
          </ul>
        ) : <p className="ws-muted mt-1 text-sm">No matching reasons were provided.</p>}
      </section>
    </div>
  );
}
