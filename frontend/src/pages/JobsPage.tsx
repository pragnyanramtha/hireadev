import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Clock3, FolderOpen, Plus } from 'lucide-react';
import { listJobs } from '../lib/firebase';

interface JobListItem {
  jobId: string;
  title: string;
  status: string;
  keywords?: string;
  totalResumes: number;
  counts: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
  shortlistedCount?: number;
  researchStatus?: string;
}

function formatDate(value?: string): string {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

export default function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      try {
        const data = await listJobs();
        if (active) {
          setJobs(data as unknown as JobListItem[]);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadJobs();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-dark)] text-slate-50 px-6 md:px-10 py-8">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-[var(--font-display)] font-bold text-2xl uppercase tracking-tighter hover:text-[var(--color-acid)] transition-colors"
          >
            hireadev_
          </button>
          <h1 className="font-[var(--font-display)] text-5xl md:text-6xl font-bold uppercase tracking-tighter mt-6 text-white">
            Job Dashboard
          </h1>
          <p className="text-slate-400 max-w-2xl mt-4">
            Resume pipelines you already created live here. Re-open any job, add more resumes,
            or start a new search.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/new-job')}
          className="inline-flex items-center gap-3 bg-[var(--color-acid)] text-black px-5 py-3 font-mono font-bold uppercase tracking-widest text-sm"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </header>

      <main className="max-w-6xl mx-auto">
        {loading && (
          <div className="border border-white/10 bg-[#121214] p-10 text-center font-mono text-sm uppercase tracking-widest text-slate-500">
            Loading jobs...
          </div>
        )}

        {!loading && error && (
          <div className="border border-[#F97316]/30 bg-[#F97316]/10 p-6 text-[#FDBA74] font-mono text-sm">
            {error}
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="border border-dashed border-white/10 bg-[#121214] p-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-full border border-white/10 flex items-center justify-center mb-5 text-slate-500">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No jobs yet</h2>
            <p className="text-slate-400 mb-6">Create your first job to start ranking resumes.</p>
            <button
              type="button"
              onClick={() => navigate('/new-job')}
              className="inline-flex items-center gap-3 bg-[var(--color-acid)] text-black px-5 py-3 font-mono font-bold uppercase tracking-widest text-sm"
            >
              <Plus className="w-4 h-4" />
              Create First Job
            </button>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {jobs.map((job) => {
              const terminal = (job.counts.completed ?? 0) + (job.counts.skipped ?? 0) + (job.counts.failed ?? 0);
              const progress = job.totalResumes > 0 ? Math.round((terminal / job.totalResumes) * 100) : 0;

              return (
                <button
                  type="button"
                  key={job.jobId}
                  onClick={() => navigate(`/analyzing/${job.jobId}`)}
                  className="text-left border border-white/10 bg-[#121214] hover:bg-[#17171A] transition-colors p-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
                          {job.jobId}
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold text-white">{job.title}</h2>
                    </div>

                    <span className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest border ${
                      job.status === 'done'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-[var(--color-acid)]/10 border-[var(--color-acid)]/20 text-[var(--color-acid)]'
                    }`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {(job.keywords ?? '').split(',').filter(Boolean).slice(0, 4).map((keyword) => (
                      <span
                        key={keyword}
                        className="bg-black/40 border border-white/10 px-2 py-1 rounded-sm text-[10px] font-mono uppercase tracking-widest text-slate-300"
                      >
                        {keyword.trim()}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Progress</div>
                      <div className="text-2xl font-mono font-bold text-white">{progress}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Shortlisted</div>
                      <div className="text-2xl font-mono font-bold text-[var(--color-acid)]">{job.shortlistedCount ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Resumes</div>
                      <div className="text-2xl font-mono font-bold text-white">{job.totalResumes}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Research</div>
                      <div className="text-2xl font-mono font-bold text-white">{job.researchStatus ?? 'idle'}</div>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-[var(--color-acid)]" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2 font-mono">
                      <Clock3 className="w-3.5 h-3.5" />
                      Updated {formatDate(job.updatedAt || job.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-2 font-mono uppercase tracking-widest text-white">
                      Open Job
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
