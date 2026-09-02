interface MatchReasonsProps {
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export default function MatchReasons({ matchedSkills, missingSkills, reasons }: MatchReasonsProps) {
  return (
    <div className="mt-6 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-3">
      <section aria-labelledby="matched-skills-heading">
        <h3 id="matched-skills-heading" className="text-sm font-semibold text-slate-200">Matched skills</h3>
        {matchedSkills.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {matchedSkills.map((skill) => <li key={skill} className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">✓ {skill}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">No required skills matched yet.</p>}
      </section>
      <section aria-labelledby="missing-skills-heading">
        <h3 id="missing-skills-heading" className="text-sm font-semibold text-slate-200">Skills to improve</h3>
        {missingSkills.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {missingSkills.map((skill) => <li key={skill} className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">+ {skill}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-emerald-300">All required skills matched.</p>}
      </section>
      <section aria-labelledby="match-reasons-heading">
        <h3 id="match-reasons-heading" className="text-sm font-semibold text-slate-200">Why this matches</h3>
        {reasons.length ? <ul className="mt-3 space-y-2 text-sm text-slate-400">{reasons.map((reason, index) => <li key={`${reason}-${index}`} className="flex gap-2"><span aria-hidden="true" className="text-cyan-400">•</span><span>{reason}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No matching reasons were provided.</p>}
      </section>
    </div>
  );
}
