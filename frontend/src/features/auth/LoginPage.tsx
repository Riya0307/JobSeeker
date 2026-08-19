import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AuthShell from "./AuthShell";
import { buttonClass, getApiError, inputClass } from "./formUtils";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login({ email, password });
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Continue your search" copy="Sign in to access your candidate workspace and profile.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <label className="block text-sm font-medium text-slate-300">Email<input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="block text-sm font-medium text-slate-300">Password<input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
        <button className={buttonClass} disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">New to JobSeeker? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/register">Create an account</Link></p>
    </AuthShell>
  );
}
