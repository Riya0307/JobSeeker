import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AuthShell from "./AuthShell";
import { buttonClass, getApiError, inputClass } from "./formUtils";

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await register(form);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="Create your account" title="Start with a stronger profile" copy="Set up your private candidate workspace. You can complete your professional details next.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-slate-300">First name<input className={inputClass} autoComplete="given-name" required value={form.first_name} onChange={(event) => update("first_name", event.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-300">Last name<input className={inputClass} autoComplete="family-name" required value={form.last_name} onChange={(event) => update("last_name", event.target.value)} /></label>
        </div>
        <label className="block text-sm font-medium text-slate-300">Email<input className={inputClass} type="email" autoComplete="email" required value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" /></label>
        <label className="block text-sm font-medium text-slate-300">Password<input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Use 8+ characters" /></label>
        <button className={buttonClass} disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">Already have an account? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
