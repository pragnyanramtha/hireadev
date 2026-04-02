import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Brain, RefreshCw } from 'lucide-react';
import { getDeepResearch, runDeepResearch, subscribeDeepResearch, subscribeJob } from '../lib/firebase';

const GROQ_BILLING_URL = 'https://console.groq.com/settings/billing';

interface MatchBands {
  skill: number;
  experience: number;
  keyword: number;
}

interface Candidate {
  candidateId: string;
  filename: string;
  name?: string;
  score: number | null;
  researchScore?: number | null;
  researchSignals?: string[];
  researchError?: string | null;
  location?: string;
  yearsExp?: number;
  email?: string;
  rationale?: string;
  flags?: string[];
  evidence?: string[];
  matchBands?: MatchBands;
  enrichment?: {
    githubUrl?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    summary?: string;
  } | null;
}

interface ResearchState {
  status: string;
  summary: string;
  candidates: Candidate[];
  error?: string | null;
  processedCount?: number;
  totalCandidates?: number;
  currentCandidate?: string | null;
}

interface JobState {
  title?: string;
  status: string;
}

function getResearchFailureMessage(error?: string | null): {
  summary: string;
  detail?: string;
  href?: string;
  cta?: string;
} {
  const normalized = (error || '').toLowerCase();

  if (normalized.includes('rate limit') || normalized.includes('429')) {
    return {
      summary: 'Need higher rate limits? Get Pro.',
      detail: 'Deep research hit the current Groq rate limit. Try again shortly or upgrade the account tier.',
      href: GROQ_BILLING_URL,
      cta: 'Upgrade',
    };
  }

  if (normalized.includes('request entity too large') || normalized.includes('413')) {
    return {
      summary: 'Deep research payload was too large.',
      detail: 'Try again after reducing the candidate set or prompt size.',
    };
  }

  return {
    summary: 'Deep research failed.',
    detail: error || 'Please try again.',
  };
}

export default function DeepResearchPage() {
  const navigate = useNavigate();
  const { jobId = '' } = useParams();
  const [job, setJob] = useState<JobState>({ status: 'loading' });
  const [research, setResearch] = useState<ResearchState>({
    status: 'idle',
    summary: '',
    candidates: [],
    processedCount: 0,
    totalCandidates: 0,
    currentCandidate: null,
  });
  const [launching, setLaunching] = useState(false);
  const autoLaunchRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const unsubs = [
      subscribeJob(jobId, (data) => setJob(data as unknown as JobState)),
      subscribeDeepResearch(jobId, (data) => setResearch(data as unknown as ResearchState)),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [jobId]);

  useEffect(() => {
    if (!jobId || autoLaunchRef.current) return;
    if (job.status !== 'done') return;

    autoLaunchRef.current = true;

    void (async () => {
      const current = await getDeepResearch(jobId);
      const status = current.status as string | undefined;
      if (!status || status === 'idle') {
        setLaunching(true);
        try {
          await runDeepResearch(jobId);
        } finally {
          setLaunching(false);
        }
      }
    })();
  }, [job.status, jobId]);

  const handleRefreshResearch = async () => {
    if (!jobId) return;
    setLaunching(true);
    try {
      await runDeepResearch(jobId);
    } finally {
      setLaunching(false);
    }
  };

  const researchFailure = getResearchFailureMessage(research.error);

  return (
    <div className="min-h-screen bg-[var(--color-bg-dark)] text-slate-100 px-6 md:px-10 py-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <button
              type="button"
              onClick={() => navigate(`/analyzing/${jobId}`)}
              className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Analysis
            </button>
            <div className="flex items-center gap-3 mt-6 mb-3">
              <Brain className="w-5 h-5 text-[var(--color-acid)]" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">Compound Research</span>
            </div>
            <h1 className="font-[var(--font-display)] text-5xl md:text-6xl font-bold uppercase tracking-tighter text-white">
              Deep Research
            </h1>
            <p className="text-slate-400 mt-4 max-w-3xl">
              Extended recruiter-grade web research and synthesis for the top candidates in this job.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest border ${
              research.status === 'done'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : research.status === 'failed'
                  ? 'bg-[#F97316]/10 border-[#F97316]/20 text-[#FDBA74]'
                  : 'bg-[var(--color-acid)]/10 border-[var(--color-acid)]/20 text-[var(--color-acid)]'
            }`}>
              {research.status}
            </span>
            <button
              type="button"
              onClick={handleRefreshResearch}
              disabled={launching || research.status === 'running' || job.status !== 'done'}
              className="inline-flex items-center gap-2 px-4 py-3 border border-white/10 bg-[#121214] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs uppercase tracking-widest"
            >
              <RefreshCw className={`w-4 h-4 ${launching || research.status === 'running' ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>
        </header>

        {job.status !== 'done' && (
          <div className="border border-white/10 bg-[#121214] p-8 text-center font-mono text-sm uppercase tracking-widest text-slate-400">
            Deep research unlocks after the initial analysis is complete.
          </div>
        )}

        {job.status === 'done' && (
          <div className="space-y-6">
            {(research.status === 'running' || launching) && (
              <div className="border border-[var(--color-acid)]/20 bg-[var(--color-acid)]/5 p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-4 border-2 border-[var(--color-acid)] border-t-transparent rounded-full animate-spin" />
                <p className="font-mono text-sm uppercase tracking-widest text-[var(--color-acid)]">
                  {research.currentCandidate
                    ? `Researching ${research.currentCandidate} (${(research.processedCount ?? 0) + 1}/${research.totalCandidates ?? 0})...`
                    : 'Running web research on top candidates...'}
                </p>
              </div>
            )}

            {research.status === 'failed' && (
              <div className="border border-[#F97316]/20 bg-[#F97316]/10 p-5 text-[#FDBA74] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest font-bold">
                    {researchFailure.summary}
                  </div>
                  {researchFailure.detail && (
                    <div className="text-sm mt-2 text-[#FDE6C8]">
                      {researchFailure.detail}
                    </div>
                  )}
                </div>
                {researchFailure.href && researchFailure.cta && (
                  <a
                    href={researchFailure.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-[#FDBA74]/30 hover:border-[#FDBA74] text-xs font-mono uppercase tracking-widest self-start"
                  >
                    {researchFailure.cta}
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {research.summary && (
              <section className="border border-white/10 bg-[#121214] p-6 md:p-8">
                <div className="font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-4">
                  Executive Report
                </div>
                <div className="whitespace-pre-wrap leading-7 text-slate-200 text-sm md:text-base">
                  {research.summary}
                </div>
              </section>
            )}

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
	              {research.candidates.map((candidate) => (
                <article key={candidate.candidateId} className="border border-white/10 bg-[#121214] p-6 flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{candidate.name || candidate.filename}</h2>
                      <p className="text-slate-400 text-sm mt-2">
                        {candidate.location || 'Location unknown'}
                        {candidate.yearsExp ? ` · ${candidate.yearsExp}y experience` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-2 border border-white/10 text-center min-w-[72px]">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Fit</div>
                        <div className="text-lg font-mono font-bold text-white">{candidate.score ?? '—'}</div>
                      </div>
                      <div className="px-3 py-2 border border-[var(--color-acid)] text-center min-w-[72px] bg-[var(--color-acid)]/5">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-acid)]">Web</div>
                        <div className="text-lg font-mono font-bold text-[var(--color-acid)]">{candidate.researchScore ?? '—'}</div>
                      </div>
                    </div>
                  </div>

                  {candidate.rationale && (
                    <p className="text-sm leading-6 text-slate-300">{candidate.rationale}</p>
                  )}

                  {candidate.enrichment?.summary && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                        Web Summary
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{candidate.enrichment.summary}</p>
                    </div>
                  )}

                  {(candidate.researchSignals?.length ?? 0) > 0 && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                        Public Signals
                      </div>
                      <div className="space-y-2">
                        {candidate.researchSignals?.map((signal) => (
                          <div key={signal} className="border-l-2 border-white/20 pl-3 text-xs text-slate-400">
                            {signal}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {candidate.researchError && (
                    <div className="text-xs text-[#FDBA74] bg-[#F97316]/10 border border-[#F97316]/20 px-3 py-2">
                      {candidate.researchError}
                    </div>
                  )}

                  <div className="space-y-2">
                    {candidate.enrichment?.githubUrl && (
                      <a href={candidate.enrichment.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-white hover:text-[var(--color-acid)]">
                        GitHub
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}
                    {candidate.enrichment?.linkedinUrl && (
                      <a href={candidate.enrichment.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-white hover:text-[var(--color-acid)] ml-4">
                        LinkedIn
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}
                    {candidate.enrichment?.portfolioUrl && (
                      <a href={candidate.enrichment.portfolioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-white hover:text-[var(--color-acid)] ml-4">
                        Portfolio
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {(candidate.evidence?.length ?? 0) > 0 && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                        Evidence
                      </div>
                      <div className="space-y-2">
                        {candidate.evidence?.map((item) => (
                          <div key={item} className="border-l-2 border-[var(--color-acid)] pl-3 text-xs text-slate-400 italic">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
