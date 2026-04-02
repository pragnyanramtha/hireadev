/**
 * Appwrite SDK initialization + real-time listener helpers.
 * Replaces Firebase with Appwrite for the backend.
 */
import { Client, Databases, ID } from 'appwrite';

const client = new Client();

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT || 'hireadev');

export const databases = new Databases(client);

const DATABASE_ID = 'main';
const JOBS_COLLECTION = 'jobs';
const CANDIDATES_COLLECTION = 'candidates';
const EVENTS_COLLECTION = 'events';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://cloud.appwrite.io/v1/functions/backend/execute';

export async function createJob(
  title: string,
  description: string,
  keywords: string,
  file: File,
): Promise<{ jobId: string }> {
  const form = new FormData();
  form.append('title', title);
  form.append('description', description);
  form.append('keywords', keywords);
  form.append('file', file);

  const res = await fetch(`${API_BASE}`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create job');
  }
  return res.json();
}

export async function shortlistCandidate(jobId: string, candidateId: string): Promise<void> {
  await fetch(`${API_BASE}/shortlist_candidate?jobId=${jobId}&candidateId=${candidateId}`, {
    method: 'POST',
  });
}

export async function retryCandidate(jobId: string, candidateId: string): Promise<void> {
  await fetch(`${API_BASE}/retry_candidate?jobId=${jobId}&candidateId=${candidateId}`, {
    method: 'POST',
  });
}

export function getExportUrl(jobId: string): string {
  return `${API_BASE}/export_shortlist?jobId=${jobId}`;
}

let jobUnsubscribe: (() => void) | null = null;
let leaderboardUnsubscribe: (() => void) | null = null;
let inProgressUnsubscribe: (() => void) | null = null;
let issuesUnsubscribe: (() => void) | null = null;
let eventsUnsubscribe: (() => void) | null = null;

export function subscribeJob(
  jobId: string,
  callback: (data: Record<string, unknown>) => void,
): () => void {
  if (jobUnsubscribe) jobUnsubscribe();
  
  const unsubscribe = databases.onDocumentChange(
    DATABASE_ID,
    JOBS_COLLECTION,
    jobId,
    (response) => {
      if (response) callback({ jobId, ...response });
    },
  );
  
  jobUnsubscribe = unsubscribe;
  return unsubscribe;
}

export function subscribeLeaderboard(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): () => void {
  if (leaderboardUnsubscribe) leaderboardUnsubscribe();

  const response = databases.listDocuments(
    DATABASE_ID,
    CANDIDATES_COLLECTION,
    [`jobId=${jobId}`, "status=completed"],
    100,
    0,
    ['score'],
    'desc',
  );

  response.then((res) => {
    callback(res.documents.map((d) => ({ candidateId: d.$id, ...d })));
  }).catch(console.error);

  return () => {};
}

export function subscribeInProgress(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): () => void {
  if (inProgressUnsubscribe) inProgressUnsubscribe();

  const response = databases.listDocuments(
    DATABASE_ID,
    CANDIDATES_COLLECTION,
    [
      `jobId=${jobId}`,
      "status=uploaded",
      "status=extracting",
      "status=extracted",
      "status=filtered",
      "status=coarse_scored",
    ],
  );

  response.then((res) => {
    callback(res.documents.map((d) => ({ candidateId: d.$id, ...d })));
  }).catch(console.error);

  return () => {};
}

export function subscribeIssues(
  jobId: string,
  callback: (candidates: Record<string, unknown>[]) => void,
): () => void {
  if (issuesUnsubscribe) issuesUnsubscribe();

  const response = databases.listDocuments(
    DATABASE_ID,
    CANDIDATES_COLLECTION,
    [`jobId=${jobId}`, "status=skipped", "status=failed", "status=retrying"],
  );

  response.then((res) => {
    callback(res.documents.map((d) => ({ candidateId: d.$id, ...d })));
  }).catch(console.error);

  return () => {};
}

export function subscribeEventFeed(
  jobId: string,
  callback: (events: Record<string, unknown>[]) => void,
): () => void {
  if (eventsUnsubscribe) eventsUnsubscribe();

  const response = databases.listDocuments(
    DATABASE_ID,
    EVENTS_COLLECTION,
    [`jobId=${jobId}`],
    50,
    0,
    ['timestamp'],
    'desc',
  );

  response.then((res) => {
    callback(
      res.documents.map((d) => ({
        id: d.$id,
        ...d,
        time: d.timestamp 
          ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '',
      })),
    );
  }).catch(console.error);

  return () => {};
}