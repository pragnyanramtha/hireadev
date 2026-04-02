import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Search,
  Download,
  UserCircle,
  FileText,
  Activity,
  Briefcase,
  Plus,
  Brain,
  X,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  subscribeJob,
  subscribeLeaderboard,
  subscribeInProgress,
  subscribeIssues,
  subscribeEventFeed,
  shortlistCandidate,
  retryCandidate,
  downloadShortlistCsv,
  appendResumes,
} from '../lib/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toTitleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStageLabel(status: string): string {
  const labels: Record<string, string> = {
    skipped: 'Initial Screening',
    failed: 'Processing',
    coarse_scoring: 'Initial Screening',
    deep_scoring: 'Deep Review',
  };

  return labels[status] || toTitleCase(status);
}

function formatSkipReason(reason?: string): string {
  if (!reason) {
    return 'Reason unavailable.';
  }

  if (reason.startsWith('coarse_below_threshold:')) {
    const rawScore = Number(reason.split(':')[1]);
    return Number.isFinite(rawScore)
      ? `Did not move past the initial screening round (${rawScore}/100).`
      : 'Did not move past the initial screening round.';
  }

  const labels: Record<string, string> = {
    duplicate_resume: 'A duplicate resume was detected.',
    domain_mismatch: 'The resume did not match the role closely enough.',
    empty_text: 'Not enough readable text could be extracted from the resume.',
    foreign_language: 'The resume appears to be in an unsupported language.',
  };

  return labels[reason] || `${toTitleCase(reason)}.`;
}

function matchesCandidateSearch(candidate: Candidate, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    candidate.name,
    candidate.filename,
    candidate.email,
    candidate.location,
    candidate.status,
    candidate.rationale,
    candidate.skipReason,
    ...(candidate.flags || []),
    ...(candidate.evidence || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchBands { skill: number; experience: number; keyword: number; }
interface Candidate {
  candidateId: string;
  filename: string;
  name?: string;
  status: string;
  score: number | null;
  shortlisted?: boolean;
  matchBands?: MatchBands;
  flags?: string[];
  rationale?: string;
  evidence?: string[];
  location?: string;
  yearsExp?: number;
  email?: string;
  enrichment?: { githubUrl?: string; linkedinUrl?: string; portfolioUrl?: string; summary?: string } | null;
  skipReason?: string;
  retryCount?: number;
}

interface PipelineEvent {
  id: string;
  time: string;
  message: string;
  type: 'success' | 'warn' | 'info';
}

interface JobState {
  status: string;
  totalResumes: number;
  counts: Record<string, number>;
  title?: string;
  keywords?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId = '' } = useParams();
  const state = location.state as { jobId?: string; jobTitle?: string; keywords?: string } || {};

  const [job, setJob] = useState<JobState>({ status: 'loading', totalResumes: 0, counts: {} });
  const [leaderboard, setLeaderboard] = useState<Candidate[]>([]);
  const [inProgress, setInProgress] = useState<Candidate[]>([]);
  const [issues, setIssues] = useState<Candidate[]>([]);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'issues' | 'analytics'>('leaderboard');
  const [isAppending, setIsAppending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const addResumeInputRef = useRef<HTMLInputElement | null>(null);

  // Unsubscribe refs
  const unsubs = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!jobId) return;

    unsubs.current.push(subscribeJob(jobId, (data) => setJob(data as unknown as JobState)));
    unsubs.current.push(subscribeLeaderboard(jobId, (data) => setLeaderboard(data as unknown as Candidate[])));
    unsubs.current.push(subscribeInProgress(jobId, (data) => setInProgress(data as unknown as Candidate[])));
    unsubs.current.push(subscribeIssues(jobId, (data) => setIssues(data as unknown as Candidate[])));
    unsubs.current.push(subscribeEventFeed(jobId, (data) => setEvents(data as unknown as PipelineEvent[])));

    return () => {
      unsubs.current.forEach((u) => u());
      unsubs.current = [];
    };
  }, [jobId]);

  // ─── Derived KPIs ──────────────────────────────────────────────────────────

  const counts = job.counts ?? {};
  const total = job.totalResumes || 1;
  const terminal = (counts.completed ?? 0) + (counts.skipped ?? 0) + (counts.failed ?? 0);
  const isDone = job.status === 'done';
  const jobKeywords = (job.keywords || state.keywords || '').split(',').filter(Boolean);
  const avgFit = leaderboard.length > 0
    ? Math.round(leaderboard.reduce((a, c) => a + (c.score ?? 0), 0) / leaderboard.length)
    : 0;
  const shortlistReady = leaderboard.filter((c) => (c.score ?? 0) >= 80).length;
  const filteredLeaderboard = leaderboard.filter((candidate) => matchesCandidateSearch(candidate, searchQuery));
  const filteredInProgress = inProgress.filter((candidate) => matchesCandidateSearch(candidate, searchQuery));
  const filteredIssues = issues.filter((candidate) => matchesCandidateSearch(candidate, searchQuery));

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleShortlist = async (c: Candidate) => {
    if (!jobId) return;
    await shortlistCandidate(jobId, c.candidateId);
    setLeaderboard((prev) => prev.map((candidate) => (
      candidate.candidateId === c.candidateId ? { ...candidate, shortlisted: true } : candidate
    )));
    setActiveCandidate((prev) => prev && prev.candidateId === c.candidateId ? { ...prev, shortlisted: true } : prev);
    setActionNotice({ type: 'info', text: `${c.name || c.filename} added to shortlist.` });
  };

  const handleRetry = async (c: Candidate) => {
    if (!jobId) return;
    await retryCandidate(jobId, c.candidateId);
    setActionNotice({ type: 'info', text: `Retry queued for ${c.name || c.filename}.` });
  };

  const handleAppendResumes = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !jobId) return;

    if (!file.name.endsWith('.zip')) {
      setActionNotice({ type: 'error', text: 'Only .zip files are accepted.' });
      event.target.value = '';
      return;
    }

    setIsAppending(true);
    try {
      const result = await appendResumes(jobId, file);
      setActionNotice({ type: 'info', text: `Queued ${result.added} additional resumes for this job.` });
    } catch (err) {
      setActionNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to append resumes.' });
    } finally {
      setIsAppending(false);
      event.target.value = '';
    }
  };

  const handleExportShortlist = async () => {
    if (!jobId) return;

    setIsExporting(true);
    try {
      const filename = await downloadShortlistCsv(jobId);
      setActionNotice({ type: 'info', text: `Downloaded ${filename}.` });
    } catch (err) {
      setActionNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to export shortlist.' });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!jobId) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-dark)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 font-mono mb-4">No active job session.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-[var(--color-acid)] text-black px-6 py-3 font-mono font-bold uppercase">
            View Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-dark)] text-slate-200 font-sans flex flex-col h-screen overflow-hidden">

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-[#0A0A0B] border-b border-white/10 px-4 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <div className="font-[var(--font-display)] font-bold text-lg uppercase tracking-tighter text-white cursor-pointer hover:text-[var(--color-acid)] transition-colors" onClick={() => navigate('/')}>
            hireadev_
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <span className="font-mono text-xs text-slate-300 font-bold uppercase tracking-wider">
              {state.jobTitle || job.title || 'Active Job'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search candidates..."
              className="bg-[#121214] border border-white/10 py-1.5 pl-9 pr-4 text-xs font-mono text-white focus:outline-none focus:border-[var(--color-acid)] rounded-sm w-64"
            />
          </div>
          <input
            ref={addResumeInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleAppendResumes}
          />
          <button
            type="button"
            onClick={() => addResumeInputRef.current?.click()}
            disabled={isAppending}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border border-white/10 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAppending ? 'Adding...' : 'Add Resumes'}
          </button>
          {isDone && (
            <button
              type="button"
              onClick={() => navigate(`/research/${jobId}`)}
              className="flex items-center gap-2 bg-[var(--color-acid)] text-black px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border border-[var(--color-acid)] transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              Deep Research
            </button>
          )}
          <button
            type="button"
            onClick={handleExportShortlist}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border border-white/10 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export Shortlist'}
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--color-acid)] to-emerald-700 flex items-center justify-center border border-white/20">
            <UserCircle className="w-5 h-5 text-black" />
          </div>
        </div>
      </header>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <section className="shrink-0 bg-[#121214] border-b border-white/5">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between p-4 md:p-6 gap-6">
          <div className="flex flex-col gap-4">
            {actionNotice && (
              <div className={cn(
                'px-4 py-3 border text-sm font-mono max-w-xl',
                actionNotice.type === 'error'
                  ? 'bg-[#F97316]/10 border-[#F97316]/30 text-[#FDBA74]'
                  : 'bg-[var(--color-acid)]/10 border-[var(--color-acid)]/20 text-[var(--color-acid)]',
              )}>
                {actionNotice.text}
              </div>
            )}
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{job.title || state.jobTitle || 'Job'}</h2>
              <span className={cn(
                "px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest rounded-sm border",
                isDone
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-[var(--color-acid)]/10 text-[var(--color-acid)] border-[var(--color-acid)]/20",
              )}>
                {isDone ? 'Complete' : 'Pipeline Active'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-mono uppercase tracking-widest text-slate-400">
              {jobKeywords.map((kw: string, i: number) => (
                <span key={i} className="bg-black/40 border border-white/10 px-2 py-1 rounded-sm">{kw.trim()}</span>
              ))}
              <span className="flex items-center gap-1.5 px-2 py-1 ml-2 text-slate-500">
                <Clock className="w-3.5 h-3.5" /> Job ID: {jobId}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 md:gap-8 mt-2">
              {[
                { label: 'Analyzed', value: `${terminal} / ${total}`, color: 'text-white' },
                { label: 'Shortlist-Ready', value: shortlistReady, color: 'text-[var(--color-acid)]' },
                { label: 'In Progress', value: inProgress.length, color: 'text-white' },
                { label: 'Skipped/Failed', value: issues.length, color: 'text-[#F97316]' },
                { label: 'Avg Fit Score', value: avgFit || '—', color: 'text-white', border: true },
              ].map(({ label, value, color, border }) => (
                <div key={label} className={cn("flex flex-col", border && "border-l border-white/10 pl-6 lg:pl-8")}>
                  <span className={cn("text-[10px] uppercase font-mono tracking-widest mb-1", color === 'text-white' ? 'text-slate-500' : color)}>{label}</span>
                  <span className={cn("text-2xl font-bold font-mono leading-none", color)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar module */}
          <div className="w-full xl:w-[400px] bg-[#0A0A0B] border border-white/10 p-4 rounded-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                {isDone ? 'Pipeline complete' : 'Analysis in progress'}
                {!isDone && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-acid)] animate-pulse" />}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {Math.round((terminal / total) * 100)}%
              </span>
            </div>
            <div className="flex w-full h-2 gap-0.5 rounded-full overflow-hidden mb-3">
              <div className="bg-slate-700 h-full transition-all" style={{ width: `${((counts.extracted ?? 0) / total) * 100}%` }} />
              <div className="bg-slate-600 h-full transition-all" style={{ width: `${((counts.filtered ?? 0) / total) * 100}%` }} />
              <div className="bg-slate-500 h-full transition-all" style={{ width: `${((counts.coarse_scored ?? 0) / total) * 100}%` }} />
              <div className="bg-[var(--color-acid)] h-full transition-all" style={{ width: `${((counts.completed ?? 0) / total) * 100}%` }} />
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              {counts.coarse_scored ?? 0} under 70B evaluation · {counts.skipped ?? 0} skipped
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex bg-[#0A0A0B] border-b border-white/5 px-4 shrink-0 overflow-x-auto">
        {(['leaderboard', 'issues', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            className={cn(
              "px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab
                ? tab === 'issues' ? "text-[#F97316] border-[#F97316]" : "text-[var(--color-acid)] border-[var(--color-acid)]"
                : "text-slate-500 border-transparent hover:text-white",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab}{tab === 'issues' && <span className="ml-2 bg-white/10 px-1.5 py-0.5 rounded-sm">{issues.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex relative">

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className={cn("flex-1 overflow-auto bg-[var(--color-bg-dark)]", activeCandidate ? "hidden lg:block lg:w-[60%]" : "w-full")}>
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#121214] text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="p-4 border-b border-white/5 w-16 text-center">Rank</th>
                  <th className="p-4 border-b border-white/5">Candidate</th>
                  <th className="p-4 border-b border-white/5 w-24 text-center">Fit Score</th>
                  <th className="p-4 border-b border-white/5 hidden md:table-cell">Match Bands</th>
                  <th className="p-4 border-b border-white/5 w-32 hidden sm:table-cell">Status</th>
                  <th className="p-4 border-b border-white/5 hidden lg:table-cell">Flags</th>
                  <th className="p-4 border-b border-white/5 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLeaderboard.map((c, i) => {
                  const isTop3 = i < 3;
                  const isActive = activeCandidate?.candidateId === c.candidateId;
                  return (
                    <tr
                      key={c.candidateId}
                      onClick={() => setActiveCandidate(c)}
                      className={cn("group cursor-pointer transition-colors", isActive ? "bg-[var(--color-acid)]/10" : "hover:bg-white/5", isTop3 && !isActive && "bg-[#121214]")}
                    >
                      <td className="p-4 text-center">
                        <span className={cn("font-mono text-lg font-bold", isTop3 ? "text-[var(--color-acid)]" : "text-slate-400")}>#{i + 1}</span>
                        {!isDone && <span className="text-[8px] uppercase tracking-widest text-slate-500 opacity-50 block leading-none">Prov.</span>}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white text-base mb-1 truncate">{c.name || c.filename}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {c.location && <span className="truncate">{c.location}</span>}
                          {c.yearsExp && <span>{c.yearsExp}y exp</span>}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className={cn("text-2xl font-mono font-bold", (c.score ?? 0) >= 80 ? "text-[var(--color-acid)]" : "text-white")}>
                          {c.score ?? '—'}
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        {c.matchBands && (
                          <div className="flex flex-col gap-1.5 w-32">
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                              <span className="w-10">Skill</span>
                              <div className="flex-1 h-1 bg-white/10 rounded-full"><div className="h-full bg-[var(--color-acid)] rounded-full" style={{ width: `${c.matchBands.skill}%` }} /></div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                              <span className="w-10">Exp</span>
                              <div className="flex-1 h-1 bg-white/10 rounded-full"><div className="h-full bg-slate-300 rounded-full" style={{ width: `${c.matchBands.experience}%` }} /></div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className={cn(
                          'px-2 py-1 border font-mono text-[10px] uppercase tracking-widest font-bold whitespace-nowrap',
                          c.shortlisted
                            ? 'bg-[var(--color-acid)]/10 text-[var(--color-acid)] border-[var(--color-acid)]/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                        )}>
                          {c.shortlisted ? 'Shortlisted' : (c.score ?? 0) >= 80 ? 'Ready' : 'Reviewed'}
                        </span>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        {c.flags?.map((f, fi) => (
                          <span key={fi} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F97316]/10 text-[#FDBA74] border border-[#F97316]/20 font-mono text-[10px] uppercase tracking-wider mb-1 mr-1">
                            <AlertCircle className="w-3 h-3" /> {f}
                          </span>
                        ))}
                      </td>
                      <td className="p-4 text-right pr-6">
                        <button
                          className="bg-transparent border border-white/20 text-white hover:border-white hover:bg-white text-xs font-bold px-3 py-1.5 transition-colors font-mono uppercase tracking-widest group-hover:text-black"
                          onClick={(e) => { e.stopPropagation(); setActiveCandidate(c); }}
                        >Review</button>
                      </td>
                    </tr>
                  );
                })}

                {/* In-progress ghost rows */}
                {filteredInProgress.map((c) => (
                  <tr key={c.candidateId} className="opacity-40">
                    <td className="p-4 text-center"><span className="text-xs font-mono">—</span></td>
                    <td className="p-4"><div className="text-sm font-mono text-slate-400">{c.filename}</div></td>
                    <td className="p-4 text-center"><Activity className="w-4 h-4 text-slate-500 animate-spin mx-auto" /></td>
                    <td className="p-4 hidden md:table-cell" />
                    <td className="p-4 hidden sm:table-cell">
                      <span className="px-2 py-1 bg-white/5 text-slate-400 border border-white/10 font-mono text-[10px] uppercase tracking-widest font-bold">{c.status}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell" />
                    <td className="p-4" />
                  </tr>
                ))}
                {filteredLeaderboard.length === 0 && filteredInProgress.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500 font-mono text-xs uppercase tracking-widest">
                      {searchQuery ? 'No candidates match your search.' : 'No candidates yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Issues tab */}
        {activeTab === 'issues' && (
          <div className="flex-1 overflow-auto p-6">
            <h3 className="text-xl font-bold mb-6 text-white">Analysis Issues ({filteredIssues.length})</h3>
            {filteredIssues.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-white/10 font-mono text-sm text-slate-500 uppercase tracking-widest">
                {searchQuery ? 'No issues match your search.' : 'No issues detected.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIssues.map((c) => (
                  <div key={c.candidateId} className="bg-[#121214] border border-[#F97316]/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="text-[#FDBA74] font-bold text-sm mb-1">{c.filename}</div>
                      <div className="text-slate-400 text-xs font-mono">
                        Stage: {formatStageLabel(c.status)} · {formatSkipReason(c.skipReason)} · Retries: {c.retryCount ?? 0}/3
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(c.retryCount ?? 0) < 3 && (
                        <button
                          onClick={() => handleRetry(c)}
                          className="text-xs font-mono font-bold uppercase tracking-widest text-[#F97316] hover:text-white transition-colors"
                        >Retry Task</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 p-6 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              <div className="bg-[#121214] border border-white/10 p-6">
                <h4 className="font-mono text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">Pipeline Funnel</h4>
                <div className="space-y-2 font-mono text-sm">
                  {[
                    ['Ingested', job.totalResumes],
                    ['Extracted', counts.extracted ?? 0],
                    ['Passed Spam Filter', counts.filtered ?? 0],
                    ['Passed Coarse Filter', counts.coarse_scored ?? 0],
                    ['Deep Scored', counts.deep_scored ?? 0],
                    ['Completed', counts.completed ?? 0],
                    ['Skipped/Failed', (counts.skipped ?? 0) + (counts.failed ?? 0)],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex justify-between border-b border-white/5 py-2">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-white">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#121214] border border-white/10 p-6">
                <h4 className="font-mono text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">Score Distribution</h4>
                {leaderboard.length === 0 ? (
                  <div className="text-slate-500 font-mono text-sm text-center py-8">Waiting for scored candidates...</div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: '90-100 (Elite)', range: [90, 100], color: 'bg-[var(--color-acid)]' },
                      { label: '80-89 (Strong)', range: [80, 90], color: 'bg-emerald-500' },
                      { label: '70-79 (Good)', range: [70, 80], color: 'bg-slate-400' },
                      { label: '<70 (Weak)', range: [0, 70], color: 'bg-slate-600' },
                    ].map(({ label, range, color }) => {
                      const count = leaderboard.filter((c) => (c.score ?? 0) >= range[0] && (c.score ?? 0) < range[1]).length;
                      const pct = leaderboard.length > 0 ? (count / leaderboard.length) * 100 : 0;
                      return (
                        <div key={label} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs text-white font-mono">
                            <span>{label}</span><span>{count}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10">
                            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Candidate Detail Panel / Event Feed ────────────────────────── */}
        <aside className={cn(
          "w-full lg:w-[400px] xl:w-[450px] shrink-0 border-l border-white/10 bg-[#0A0A0B] flex flex-col absolute lg:relative right-0 h-full z-20",
          activeCandidate ? "flex" : "hidden lg:flex",
        )}>
          {activeCandidate ? (
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="p-6 border-b border-white/10 bg-[#121214] relative">
                <button
                  type="button"
                  onClick={() => setActiveCandidate(null)}
                  className="absolute top-4 right-4 inline-flex items-center gap-2 border border-white/10 bg-[#0A0A0B] hover:bg-white/5 text-white px-3 py-2 text-[10px] font-mono uppercase tracking-widest"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </button>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{activeCandidate.name || activeCandidate.filename}</h3>
                    <p className="text-sm text-slate-400 font-mono">
                      {activeCandidate.location}{activeCandidate.yearsExp && ` · ${activeCandidate.yearsExp}y exp`}
                    </p>
                    {activeCandidate.email && <p className="text-xs text-slate-500 font-mono mt-1">{activeCandidate.email}</p>}
                  </div>
                  <div className="w-16 h-16 rounded border-2 border-[var(--color-acid)] flex items-center justify-center bg-[var(--color-acid)]/10 text-2xl font-bold text-[var(--color-acid)] font-mono">
                    {activeCandidate.score ?? '—'}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleShortlist(activeCandidate)}
                    disabled={activeCandidate.shortlisted}
                    className="flex-1 bg-[var(--color-acid)] text-black font-bold font-mono text-xs uppercase tracking-widest py-3 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activeCandidate.shortlisted ? 'Shortlisted' : 'Shortlist'}
                  </button>
                  {activeCandidate.enrichment?.githubUrl && (
                    <a href={activeCandidate.enrichment.githubUrl} target="_blank" rel="noopener noreferrer" className="px-4 border border-white/20 text-white hover:bg-white/10 transition-colors flex items-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-8 flex-1">
                {activeCandidate.rationale && (
                  <section>
                    <h4 className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3 border-b border-white/5 pb-2">AI Summary</h4>
                    <p className="text-sm leading-relaxed text-slate-300">{activeCandidate.rationale}</p>
                  </section>
                )}
                {(activeCandidate.evidence?.length ?? 0) > 0 && (
                  <section>
                    <h4 className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3 border-b border-white/5 pb-2">Extracted Evidence</h4>
                    <div className="space-y-3">
                      {activeCandidate.evidence!.map((q, i) => (
                        <div key={i} className="pl-3 border-l-2 border-[var(--color-acid)] text-xs font-mono text-slate-400 italic">{q}</div>
                      ))}
                    </div>
                  </section>
                )}
                {activeCandidate.enrichment && (
                  <section>
                    <h4 className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3 border-b border-white/5 pb-2">Web Enrichment</h4>
                    {activeCandidate.enrichment.summary && (
                      <p className="text-xs text-slate-300 mb-3 leading-relaxed">{activeCandidate.enrichment.summary}</p>
                    )}
                    <div className="flex flex-col gap-2">
                      {activeCandidate.enrichment.githubUrl && (
                        <a href={activeCandidate.enrichment.githubUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-[#121214] border border-white/10 px-3 py-2 text-slate-300 hover:text-white transition-colors truncate">
                          GitHub: {activeCandidate.enrichment.githubUrl}
                        </a>
                      )}
                      {activeCandidate.enrichment.linkedinUrl && (
                        <a href={activeCandidate.enrichment.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-[#121214] border border-white/10 px-3 py-2 text-slate-300 hover:text-white transition-colors truncate">
                          LinkedIn: {activeCandidate.enrichment.linkedinUrl}
                        </a>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-white">Analysis Feed</span>
                <Activity className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {events.length === 0 && (
                  <div className="text-center text-slate-600 font-mono text-xs uppercase tracking-widest pt-8">Waiting for pipeline events...</div>
                )}
                {events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 items-start">
                    <div className="mt-0.5 shrink-0">
                      {ev.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[var(--color-acid)]" /> :
                       ev.type === 'warn' ? <AlertCircle className="w-4 h-4 text-[#F97316]" /> :
                       <FileText className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-relaxed",
                        ev.type === 'success' ? "text-slate-200" :
                        ev.type === 'warn' ? "text-[#FDBA74]" :
                        "text-slate-400"
                      )}>{ev.message}</p>
                      <span className="text-[10px] font-mono text-slate-600 mt-1 block">{ev.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
