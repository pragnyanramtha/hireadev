/**
 * Firebase SDK initialization + real-time listener helpers.
 * Uses simple REST API (works with local server or any backend)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const POLL_INTERVAL_MS = 1000;

// ── REST helpers ─────────────────────────────────────────────────────────────

async function callApi(endpoint: string, method: string = 'GET', body?: unknown) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as Record<string, unknown>).error as string
      || (err as Record<string, unknown>).detail as string
      || `HTTP ${res.status}`,
    );
  }
  
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.text();
  }
  
  return res.json();
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Unable to read selected ZIP file.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unexpected upload payload.'));
        return;
      }

      const [, base64 = ''] = reader.result.split(',', 2);
      resolve(base64);
    };

    reader.readAsDataURL(file);
  });
}

function subscribeList<T>(
  endpoint: string,
  callback: (data: T) => void,
): Unsubscribe {
  let callbackCalled = false;

  const poll = async () => {
    try {
      const data = await callApi(endpoint);
      if (!callbackCalled) callback(data as T);
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
    }
  };

  poll();
  const interval = setInterval(poll, POLL_INTERVAL_MS);

  return () => {
    callbackCalled = true;
    clearInterval(interval);
  };
}

export async function createJob(
  title: string,
  description: string,
  keywords: string,
  file: File,
): Promise<{ jobId: string }> {
  const zipBase64 = await readFileAsBase64(file);

  return callApi('/create_job', 'POST', {
    title,
    description,
    keywords,
    zipFilename: file.name,
    zipBase64,
  }) as Promise<{ jobId: string }>;
}

export async function appendResumes(jobId: string, file: File): Promise<{ status: string; added: number }> {
  const zipBase64 = await readFileAsBase64(file);

  return callApi('/append_resumes', 'POST', {
    jobId,
    zipFilename: file.name,
    zipBase64,
  }) as Promise<{ status: string; added: number }>;
}

export async function listJobs(): Promise<Record<string, unknown>[]> {
  return callApi('/list_jobs') as Promise<Record<string, unknown>[]>;
}

export async function getDeepResearch(jobId: string): Promise<Record<string, unknown>> {
  return callApi(`/get_deep_research?jobId=${jobId}`) as Promise<Record<string, unknown>>;
}

export async function runDeepResearch(jobId: string): Promise<Record<string, unknown>> {
  return callApi('/run_deep_research', 'POST', { jobId }) as Promise<Record<string, unknown>>;
}

export async function shortlistCandidate(jobId: string, candidateId: string): Promise<void> {
  await callApi('/shortlist_candidate', 'POST', { jobId, candidateId });
}

export async function retryCandidate(jobId: string, candidateId: string): Promise<void> {
  await callApi('/retry_candidate', 'POST', { jobId, candidateId });
}

export function getExportUrl(jobId: string): string {
  return `${API_BASE}/export_shortlist?jobId=${jobId}`;
}

// ── Real-time Appwrite listeners ────────────────────────────────────────────

type Unsubscribe = () => void;

export function subscribeJob(
  jobId: string,
  callback: (data: Record<string, unknown>) => void,
): Unsubscribe {
  return subscribeList<Record<string, unknown>>(
    `/get_job?jobId=${jobId}`,
    (data) => callback({ jobId, ...data }),
  );
}

export function subscribeLeaderboard(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): Unsubscribe {
  return subscribeList<Record<string, unknown>[]>(
    `/get_leaderboard?jobId=${jobId}`,
    callback,
  );
}

export function subscribeInProgress(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): Unsubscribe {
  return subscribeList<Record<string, unknown>[]>(
    `/get_in_progress?jobId=${jobId}`,
    callback,
  );
}

export function subscribeIssues(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): Unsubscribe {
  return subscribeList<Record<string, unknown>[]>(
    `/get_issues?jobId=${jobId}`,
    callback,
  );
}

export function subscribeEventFeed(
  jobId: string,
  callback: (events: Record<string, unknown>[]) => void,
): Unsubscribe {
  return subscribeList<Record<string, unknown>[]>(
    `/get_events?jobId=${jobId}`,
    callback,
  );
}

export function subscribeDeepResearch(
  jobId: string,
  callback: (data: Record<string, unknown>) => void,
): Unsubscribe {
  return subscribeList<Record<string, unknown>>(
    `/get_deep_research?jobId=${jobId}`,
    callback,
  );
}
