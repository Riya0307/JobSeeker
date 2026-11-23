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
      className={`ws-badge shrink-0 flex-col text-center ${compact ? "gap-0 px-2 py-1" : "gap-0 px-3 py-2"}`}
    >
      <strong className={`${compact ? "text-base" : "text-xl"} tabular-nums`}>{score}%</strong>
      <span className="text-xs font-medium">{compact ? "Match" : label}</span>
    </div>
  );
}
