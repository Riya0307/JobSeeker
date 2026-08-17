import { useEffect, useState } from "react";
import { checkBackendHealth } from "../api/health";

function HomePage() {
  const [backendStatus, setBackendStatus] = useState<string>("checking...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkBackendHealth()
      .then((data) => setBackendStatus(data.status))
      .catch(() => {
        setError("Unable to reach backend API");
        setBackendStatus("unavailable");
      });
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Welcome</h2>
      <p className="text-slate-300">
        JobSeeker helps individual job seekers manage resumes, discover jobs,
        track applications, and prepare for interviews. Application features
        are not implemented yet — this is the initial project setup.
      </p>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Backend health</p>
        <p className="font-mono text-lg">{backendStatus}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}

export default HomePage;
