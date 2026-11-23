import { useEffect, useState } from "react";
import * as applications from "../../features/applications/api";
import { getApiError } from "../../features/auth/formUtils";
import * as interviews from "../../features/interviews/api";
import * as jobs from "../../features/jobs/api";
import * as matching from "../../features/matching/api";
import * as profile from "../../features/profile/api";
import * as resumes from "../../features/resumes/api";

function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    load().then((result) => {
      if (current) setData(result);
    }).catch((reason: unknown) => {
      if (current) setError(getApiError(reason));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [load, attempt]);

  return { data, setData, loading, error, retry: () => setAttempt((value) => value + 1) };
}

async function loadUpcoming() {
  const [scheduled, rescheduled] = await Promise.all([
    interviews.listInterviews({ upcoming: true, status: "scheduled", pageSize: 3 }),
    interviews.listInterviews({ upcoming: true, status: "rescheduled", pageSize: 3 }),
  ]);
  const results = [...scheduled.results, ...rescheduled.results]
    .sort((left, right) => Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at) || left.id - right.id)
    .slice(0, 3);
  return { count: scheduled.count + rescheduled.count, results };
}

const loadResumes = async () => (await resumes.listResumes()).length;
const loadApplications = () => applications.listApplications(1, 5);
const loadSavedJobs = () => jobs.listSavedJobs(1, 1);
const loadMatches = () => matching.listJobMatches(1, 3);

export function useDashboardData() {
  return {
    profile: useResource(profile.getProfile),
    resumes: useResource(loadResumes),
    applications: useResource(loadApplications),
    interviews: useResource(loadUpcoming),
    savedJobs: useResource(loadSavedJobs),
    matches: useResource(loadMatches),
  };
}
