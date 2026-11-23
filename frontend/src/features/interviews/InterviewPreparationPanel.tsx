import { useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { getApiError } from "../auth/formUtils";
import { prepareInterview } from "./api";
import type { InterviewPreparation } from "./types";

function PreparationSection({ title, items }: { title: string; items: ReactNode[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <h3 className="font-semibold text-slate-100">{title}</h3>
      <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </section>
  );
}

export default function InterviewPreparationPanel({ interviewId }: { interviewId: number }) {
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [preparation, setPreparation] = useState<InterviewPreparation | null>(null);

  async function generate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setMessage("");
    try {
      const response = await prepareInterview(interviewId);
      if (response.status === "generated") setPreparation(response.preparation);
      else setMessage(response.detail);
    } catch (error) {
      const body = axios.isAxiosError<unknown>(error) ? error.response?.data : null;
      setMessage(
        body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
          ? body.detail
          : getApiError(error),
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="interview-preparation-title" className="border-t border-white/10 pt-7">
      <h2 id="interview-preparation-title" className="text-lg font-semibold">Interview preparation</h2>
      <p className="mt-2 text-sm text-slate-400">
        Gemini uses saved profile and role details to suggest material for practice.
        AI-generated suggestions can be inaccurate, and actual interview questions may differ.
      </p>
      {!preparation && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="mt-4 rounded-xl border border-cyan-400/40 px-5 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50"
        >
          {loading ? "Preparing…" : message ? "Try again" : "Prepare for this interview"}
        </button>
      )}
      <p role="status" className="mt-2 text-sm text-slate-300">
        {loading ? "Generating your practice guide." : message || (preparation ? "Practice guide ready." : "")}
      </p>
      {preparation && (
        <div className="mt-4 space-y-4 break-words">
          <p className="text-sm leading-relaxed text-slate-300">{preparation.overview}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <PreparationSection title="Technical topics" items={preparation.technical_topics.map(
              ({ topic, reason, priority }) => <><strong>{topic}</strong> · {priority} priority<p>{reason}</p></>,
            )} />
            <PreparationSection title="Technical practice questions" items={preparation.technical_questions.map(
              ({ question, what_interviewer_assesses, preparation_guidance }) => (
                <><strong>{question}</strong><p>What it could assess — {what_interviewer_assesses}</p><p>{preparation_guidance}</p></>
              ),
            )} />
            <PreparationSection title="Behavioral practice questions" items={preparation.behavioral_questions.map(
              ({ question, guidance }) => <><strong>{question}</strong><p>{guidance}</p></>,
            )} />
            <PreparationSection title="Skills to review" items={preparation.profile_gaps.map(
              ({ area, guidance }) => <><strong>{area}</strong><p>{guidance}</p></>,
            )} />
            <PreparationSection title="Questions to ask" items={preparation.questions_to_ask} />
            <PreparationSection title="Preparation checklist" items={preparation.preparation_checklist.map(
              (item) => (
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-cyan-400" />
                  <span>{item}</span>
                </label>
              ),
            )} />
          </div>
        </div>
      )}
    </section>
  );
}
