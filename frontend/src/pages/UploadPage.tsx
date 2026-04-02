import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Folder, FileArchive, Upload, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createJob } from '../lib/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { jobTitle?: string; description?: string; keywords?: string } || {};

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const processFile = (f: File) => {
    if (!f.name.endsWith('.zip')) {
      setError('Only .zip files are accepted');
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setError('File too large (max 500MB)');
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (chosen) processFile(chosen);
  };

  const handleSubmit = async () => {
    if (!file) return;
    if (!state.jobTitle || !state.description) {
      navigate('/new-job');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const { jobId } = await createJob(
        state.jobTitle,
        state.description,
        state.keywords ?? '',
        file,
      );
      navigate('/analyzing', {
        state: {
          jobId,
          jobTitle: state.jobTitle,
          keywords: state.keywords,
          description: state.description,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-dark)] text-slate-50 flex flex-col font-sans selection:bg-[var(--color-acid)] selection:text-black">
      <nav className="w-full relative z-50 flex justify-between items-center p-6 lg:p-8">
        <div
          className="font-[var(--font-display)] font-bold text-2xl uppercase tracking-tighter cursor-pointer hover:text-[var(--color-acid)] transition-colors"
          onClick={() => navigate('/')}
        >
          hireadev_
        </div>
        <div className="font-mono text-xs text-[var(--color-text-muted)] tracking-widest uppercase border border-white/10 px-4 py-2 bg-[#0A0A0B]">
          SYSTEM_UPLOAD_PROTOCOL
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-5xl mx-auto">

        {/* Job context badge */}
        {state.jobTitle && (
          <div className="w-full max-w-3xl mb-6 flex items-center gap-3 bg-[#121214] border border-white/10 px-4 py-3">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Pipeline target:</span>
            <span className="font-bold text-white text-sm">{state.jobTitle}</span>
            {state.keywords && (
              <span className="font-mono text-xs text-[var(--color-acid)] ml-auto hidden sm:inline">{state.keywords}</span>
            )}
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="font-[var(--font-display)] text-5xl md:text-6xl font-bold uppercase tracking-tighter mb-4 text-white">
            Upload Resumes
          </h1>
          <p className="text-[var(--color-text-muted)] font-medium max-w-xl mx-auto text-base md:text-lg">
            Drop a ZIP archive of resumes to begin the AI pipeline processing.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="w-full max-w-3xl mb-4 flex items-center gap-3 bg-[#F97316]/10 border border-[#F97316]/30 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-[#F97316] shrink-0" />
            <span className="text-sm text-[#FDBA74] font-mono">{error}</span>
          </div>
        )}

        {/* Drop zone */}
        <div
          className={cn(
            'w-full max-w-3xl min-h-[450px] border-2 border-dashed flex flex-col items-center justify-center text-center transition-all duration-300 relative group cursor-pointer bg-[#0A0A0B] py-12 px-6',
            isDragging
              ? 'border-[var(--color-acid)] bg-[var(--color-acid)]/5 scale-[1.02] shadow-[0_0_50px_rgba(163,230,53,0.15)]'
              : file
                ? 'border-[var(--color-acid)]/50 bg-[var(--color-acid)]/5'
                : 'border-white/20 hover:border-[var(--color-acid)] hover:bg-[#121214]',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && document.getElementById('file-input')?.click()}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-[var(--color-acid)]/5 animate-pulse" />
          )}

          <input
            id="file-input"
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileInput}
          />

          <div className="relative z-10 flex flex-col items-center p-8">
            {file ? (
              <>
                <div className="bg-[var(--color-acid)] p-4 mb-6 transition-all duration-300">
                  <Upload className="w-10 h-10 text-black" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl md:text-3xl font-[var(--font-display)] font-bold text-white mb-2 uppercase tracking-tight">
                  {file.name}
                </h2>
                <p className="text-[var(--color-acid)] font-mono text-sm uppercase tracking-widest mb-2">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · Ready to process
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-xs font-mono text-slate-500 hover:text-white transition-colors mt-2 underline"
                >
                  Remove file
                </button>
              </>
            ) : (
              <>
                <div className="bg-[#121214] p-4 border border-white/5 mb-6 group-hover:scale-110 group-hover:bg-[var(--color-acid)] transition-all duration-300 group-hover:text-black text-[var(--color-acid)]">
                  <FileArchive className="w-10 h-10" strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl md:text-3xl font-[var(--font-display)] font-bold text-white mb-2 uppercase tracking-tight">
                  Drop ZIP file here
                </h2>
                <p className="text-slate-500 font-mono text-sm uppercase tracking-widest mb-6 border-b border-white/5 pb-6 w-full">
                  or drag & drop
                </p>

                <div className="flex items-center gap-4 bg-[#121214] border border-white/10 px-5 py-3 mb-8 w-max group-hover:border-[var(--color-signal)]/50 transition-colors">
                  <Folder className="w-5 h-5 text-[var(--color-signal)]" />
                  <div className="text-left font-mono text-[10px] sm:text-xs">
                    <span className="text-white block uppercase tracking-wider font-bold mb-0.5">Also supports folder drop</span>
                    <span className="text-slate-500">(Chrome desktop only)</span>
                  </div>
                </div>

                <div className="font-mono text-xs text-slate-500 border-t border-white/10 pt-6 w-full max-w-sm mx-auto">
                  <span className="uppercase tracking-widest block mb-2 font-bold text-[var(--color-acid)]/70">Accepted Formats:</span>
                  <span className="leading-relaxed">
                    .zip containing PDF, DOCX, DOC, or{' '}
                    <span className="text-white">Images (PNG, JPG, JPEG)</span> for OCR
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Submit button */}
        {file && (
          <div className="w-full max-w-3xl mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isUploading}
              className="bg-[var(--color-acid)] text-black px-10 py-4 font-mono font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Uploading & Initializing Pipeline...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Launch Pipeline
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
