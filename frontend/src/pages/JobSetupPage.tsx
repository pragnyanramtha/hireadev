import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Key, AlignLeft, ArrowRight } from 'lucide-react';

export default function JobSetupPage() {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle || !description) return;
    
    // In a real app we'd save this to global state or context.
    navigate('/upload', { 
      state: { jobTitle, description, keywords } 
    });
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
          SYSTEM.JOB_CONTEXT
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-3xl mx-auto py-12">
        <div className="w-full text-left mb-12">
          <h1 className="font-[var(--font-display)] text-5xl md:text-6xl font-bold uppercase tracking-tighter mb-4 text-white">
            Define Target Profile
          </h1>
          <p className="text-[var(--color-text-muted)] font-medium text-base md:text-lg">
            Initialize the ranking engine context. The 70B semantic model will evaluate all candidates against this specific rubric.
          </p>
        </div>

        <form onSubmit={handleContinue} className="w-full space-y-8">
          
          <div className="space-y-4">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest font-bold text-[var(--color-acid)]">
              <Briefcase className="w-4 h-4" /> Job Title <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full bg-[#0A0A0B] border border-white/20 p-4 text-white font-medium focus:outline-none focus:border-[var(--color-acid)] transition-colors placeholder:text-white/20"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest font-bold text-[var(--color-acid)]">
              <Key className="w-4 h-4" /> Keywords & Mandatory Skills <span className="text-white/30">(Optional)</span>
            </label>
            <input 
              type="text" 
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. React, Next.js, WebGL, 5+ years"
              className="w-full bg-[#0A0A0B] border border-white/20 p-4 text-white font-medium focus:outline-none focus:border-[var(--color-acid)] transition-colors placeholder:text-white/20"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest font-bold text-[var(--color-acid)]">
              <AlignLeft className="w-4 h-4" /> Job Description <span className="text-red-500">*</span>
            </label>
            <textarea 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the full job description here. The AI uses this to build the scoring rubric."
              className="w-full bg-[#0A0A0B] border border-white/20 p-4 text-white font-medium focus:outline-none focus:border-[var(--color-acid)] transition-colors h-48 resize-y placeholder:text-white/20"
            />
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-end">
            <button 
              type="submit"
              disabled={!jobTitle || !description}
              className="bg-[var(--color-acid)] text-black px-8 py-4 font-mono font-bold uppercase tracking-widest text-sm hover:bg-[#121214] hover:text-[var(--color-acid)] border border-[var(--color-acid)] transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              Construct Pipeline Context 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
        </form>
      </main>
    </div>
  );
}
