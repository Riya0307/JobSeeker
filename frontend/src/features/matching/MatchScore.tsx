interface MatchScoreProps {
  score: number;
  compact?: boolean;
}

function interpretation(score: number) {
  if (score >= 80) return "Excellent match";
  if (score >= 60) return "Good match";
  if (score >= 40) return "Moderate match";
  return "Low match";
}

export default function MatchScore({ score, compact = false }: MatchScoreProps) {
  const label = interpretation(score);
  return (
    <div
      aria-label={`${score}% match, ${label}`}
      className={`shrink-0 rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-center ${compact ? "px-3 py-2" : "px-4 py-3"}`}
    >
      <strong className={`${compact ? "text-xl" : "text-2xl"} block text-cyan-200`}>{score}%</strong>
      <span className="mt-0.5 block text-xs font-medium text-cyan-300">{compact ? "Match" : label}</span>
    </div>
  );
}
