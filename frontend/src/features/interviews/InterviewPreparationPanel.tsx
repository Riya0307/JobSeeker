import { useRef, useState, type ReactNode } from "react";
import axios from "axios";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import { getApiError } from "../auth/formUtils";
import { prepareInterview } from "./api";
import type { InterviewPreparation } from "./types";

function PreparationSection({ title, items }: { title: string; items: ReactNode[] }) {
  if (!items.length) return null;
  return (
    <section className="ws-card min-w-0 p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="ws-muted mt-3 space-y-3 wrap-anywhere text-sm leading-relaxed">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </section>
  );
}

export default function InterviewPreparationPanel({ interviewId }: { interviewId: number }) {
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [preparation, setPreparation] = useState<InterviewPreparation | null>(null);

  async function generate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await prepareInterview(interviewId);
      if (response.status === "generated") setPreparation(response.preparation);
      else {
        setFailed(response.status === "unavailable");
        setMessage(response.detail || "Preparation is not ready. Try again shortly.");
      }
    } catch (error) {
      setFailed(true);
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
    <section aria-labelledby="interview-preparation-title" className="ws-card p-4 sm:p-6">
      <h2 id="interview-preparation-title" className="ws-heading flex items-center gap-2"><WorkspaceIcon name="spark" size={19} /> Interview preparation</h2>
      <p className="ws-muted mt-2 max-w-[72ch] text-sm">
        Gemini uses saved profile and role details to suggest material for practice.
        AI-generated suggestions can be inaccurate, and actual interview questions may differ.
      </p>
      {!preparation && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="ws-button ws-button-primary mt-4"
        >
          {loading ? "Preparing…" : message ? "Try again" : "Prepare for this interview"}
        </button>
      )}
      {failed ? <p role="alert" className="ws-alert mt-3 wrap-anywhere">{message}</p> :
        <p role="status" className="ws-muted mt-2 text-sm">
          {loading ? "Generating your practice guide." : message || (preparation ? "Practice guide ready." : "")}
        </p>}
      {preparation && (
        <div className="mt-4 space-y-4 wrap-anywhere">
          <p className="ws-muted max-w-[72ch] text-sm leading-relaxed">{preparation.overview}</p>
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
                <label className="flex min-h-10 cursor-pointer items-start gap-3 py-1">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--ws-accent)]" />
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
