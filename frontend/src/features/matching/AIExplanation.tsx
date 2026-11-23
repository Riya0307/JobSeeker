import { useRef, useState } from "react";
import { getApiError } from "../auth/formUtils";
import { explainJobMatch } from "./api";
import type { MatchExplanation } from "./types";

interface Props { jobId: number }

function TextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <section><h4 className="text-sm font-semibold">{title}</h4><ul className="mt-2 space-y-2 ws-muted wrap-anywhere text-sm">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span aria-hidden="true" className="ws-muted">•</span><span>{item}</span></li>)}</ul></section>;
}

export default function AIExplanation({ jobId }: Props) {
  const [explanation, setExplanation] = useState<MatchExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"generated" | "cached" | "">("");

  const inFlight = useRef(false);

  async function generate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true); setError("");
    try {
      const result = await explainJobMatch(jobId);
      if (!result.explanation) { setError(result.detail || "The AI explanation is not ready. Please try again."); return; }
      setExplanation(result.explanation);
      setSource(result.status === "cached" ? "cached" : "generated");
    } catch (reason) { setError(`AI explanation unavailable. ${getApiError(reason)}`); }
    finally { inFlight.current = false; setLoading(false); }
  }

  if (!explanation) return <div className="ws-divider mt-4 border-t pt-4">
    <button type="button" disabled={loading} onClick={() => void generate()} className="ws-button">{loading ? "Generating explanation..." : "Explain this match with AI"}</button>
    <p className="mt-2 text-xs ws-muted">Optional Gemini guidance. </p>
    {error && <div role="alert" className="mt-3 ws-alert">{error} <button type="button" onClick={() => void generate()} className="ws-link">Retry</button></div>}
  </div>;

  return <section className="ws-card mt-4 p-4" aria-labelledby={`ai-explanation-${jobId}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id={`ai-explanation-${jobId}`} className="font-semibold">AI match explanation</h3><span className="text-xs ws-muted">{source === "cached" ? "Reused for this profile and job" : "Generated for this profile and job"}</span></div>
    <p className="mt-3 ws-muted wrap-anywhere text-sm leading-6">{explanation.summary}</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <TextList title="Strengths" items={explanation.strengths} />
      {explanation.skill_gaps.length > 0 && <section><h4 className="text-sm font-semibold">Skill gaps</h4><ul className="mt-2 space-y-2">{explanation.skill_gaps.map((gap) => <li key={gap.skill} className="ws-muted wrap-anywhere text-sm"><span className="font-semibold">{gap.skill}</span> <span className="text-xs uppercase ws-muted">({gap.importance})</span><p>{gap.explanation}</p></li>)}</ul></section>}
      {explanation.experience_alignment && <section><h4 className="text-sm font-semibold">Experience alignment</h4><p className="mt-2 ws-muted wrap-anywhere text-sm">{explanation.experience_alignment}</p></section>}
      <TextList title="Application tips" items={explanation.application_tips} />
      <TextList title="Considerations" items={explanation.considerations} />
    </div>
    <p className="mt-4 text-xs ws-muted">AI guidance may be incomplete. Use it alongside the match score and reasons.</p>
  </section>;
}
