/**
 * Firebase SDK initialization + real-time listener helpers.
 * Uses simple REST API (works with local server or any backend)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// ── REST helpers ─────────────────────────────────────────────────────────────

async function callApi(endpoint: string, method: string = 'GET', body?: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.text();
  }
  
  return res.json();
}

export async function createJob(
  title: string,
  description: string,
  keywords: string,
  file: File,
): Promise<{ jobId: string }> {
  return callApi('/create_job', 'POST', { title, description, keywords });
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
  let callbackCalled = false;
  
  const poll = async () => {
    try {
      const data = await callApi(`/get_job?jobId=${jobId}`);
      if (!callbackCalled) callback({ jobId, ...data });
    } catch (e) {
      console.error('Error fetching job:', e);
    }
  };

  poll();
  const interval = setInterval(poll, 3000);

  return () => {
    callbackCalled = true;
    clearInterval(interval);
  };
}

export function subscribeLeaderboard(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): Unsubscribe {
  return () => {};
}

export function subscribeInProgress(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): Unsubscribe {
  return () => {};
}

export function subscribeIssues(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): Unsubscribe {
  return () => {};
}

export function subscribeEventFeed(
  jobId: string,
  callback: (events: Record<string, unknown>[]) => void,
): Unsubscribe {
  return () => {};
}