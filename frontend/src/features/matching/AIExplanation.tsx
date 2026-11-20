import { useState } from "react";
import { getApiError } from "../auth/formUtils";
import { explainJobMatch } from "./api";
import type { MatchExplanation } from "./types";

interface Props { jobId: number }

function TextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <section><h4 className="text-sm font-semibold text-slate-200">{title}</h4><ul className="mt-2 space-y-2 text-sm text-slate-400">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span aria-hidden="true" className="text-violet-300">•</span><span>{item}</span></li>)}</ul></section>;
}

export default function AIExplanation({ jobId }: Props) {
  const [explanation, setExplanation] = useState<MatchExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"generated" | "cached" | "">("");

  async function generate() {
    setLoading(true); setError("");
    try {
      const result = await explainJobMatch(jobId);
      if (!result.explanation) { setError(result.detail || "The AI explanation is not ready. Please try again."); return; }
      setExplanation(result.explanation);
      setSource(result.status === "cached" ? "cached" : "generated");
    } catch (reason) { setError(`AI explanation unavailable. ${getApiError(reason)}`); }
    finally { setLoading(false); }
  }

  if (!explanation) return <div className="mt-5 border-t border-white/10 pt-5">
    <button type="button" disabled={loading} onClick={() => void generate()} className="rounded-lg border border-violet-400/40 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-400/10 disabled:opacity-50">{loading ? "Generating explanation..." : "Explain this match with AI"}</button>
    <p className="mt-2 text-xs text-slate-500">Optional Gemini guidance. Your deterministic score and ranking do not change.</p>
    {error && <div role="alert" className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error} <button type="button" onClick={() => void generate()} className="font-semibold underline">Retry</button></div>}
  </div>;

  return <section className="mt-5 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4" aria-labelledby={`ai-explanation-${jobId}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id={`ai-explanation-${jobId}`} className="font-semibold text-violet-100">AI match explanation</h3><span className="text-xs text-slate-500">{source === "cached" ? "Reused for this profile and job" : "Generated for this profile and job"}</span></div>
    <p className="mt-3 text-sm leading-6 text-slate-300">{explanation.summary}</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <TextList title="Strengths" items={explanation.strengths} />
      {explanation.skill_gaps.length > 0 && <section><h4 className="text-sm font-semibold text-slate-200">Skill gaps</h4><ul className="mt-2 space-y-2">{explanation.skill_gaps.map((gap) => <li key={gap.skill} className="text-sm text-slate-400"><span className="font-medium text-amber-200">{gap.skill}</span> <span className="text-xs uppercase text-slate-500">({gap.importance})</span><p>{gap.explanation}</p></li>)}</ul></section>}
      {explanation.experience_alignment && <section><h4 className="text-sm font-semibold text-slate-200">Experience alignment</h4><p className="mt-2 text-sm text-slate-400">{explanation.experience_alignment}</p></section>}
      <TextList title="Application tips" items={explanation.application_tips} />
      <TextList title="Considerations" items={explanation.considerations} />
    </div>
    <p className="mt-4 text-xs text-slate-500">AI guidance may be incomplete. The score and deterministic reasons above remain authoritative.</p>
  </section>;
}
