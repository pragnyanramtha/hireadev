import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  Layers,
  Check,
  ChevronDown,
  Terminal,
  Cpu
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-dark)] text-slate-50 selection:bg-[var(--color-acid)] selection:text-black">
      {/* NAVIGATION - Compressed to top right */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center p-6 mix-blend-difference">
        <div className="font-[var(--font-display)] font-bold text-xl tracking-tighter uppercase">hireadev_</div>
        <div className="hidden md:flex gap-8 text-sm font-medium items-center">
          <a href="#features" className="hover:text-[var(--color-acid)] transition-colors">FEATURES</a>
          <a href="#pricing" className="hover:text-[var(--color-acid)] transition-colors">PRICING</a>
          <a href="#faq" className="hover:text-[var(--color-acid)] transition-colors">FAQ</a>
          <a href="/new-job" className="brutal-button !py-2 !px-4 text-xs">DASHBOARD</a>
        </div>
      </nav>

      {/* HERO SECTION - Typographic Brutalism (90/10 Split) */}
      <section className="relative min-h-[90vh] pt-32 pb-16 px-6 md:px-12 flex flex-col justify-end overflow-hidden">
        {/* Abstract background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_70%,transparent_100%)] top-0 left-0 -z-10"></div>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-9 space-y-8">
            <h1 className="font-[var(--font-display)] text-[12vw] sm:text-[10vw] lg:text-[130px] leading-[0.85] font-bold tracking-tighter uppercase">
              Resume <br />
              <span className="text-[var(--color-acid)]">Filter</span><br />
              Engine
            </h1>
            <p className="text-xl md:text-2xl text-[var(--color-text-muted)] font-light max-w-2xl text-balance pt-8 border-t border-white/10 uppercase tracking-wide">
              Transform hours of manual CV parsing into a 3-second decision. We use SOTA models to filter the noise and deliver your elite candidates.
            </p>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-6 justify-end">
            <a href="/new-job" className="brutal-button brutal-button-primary group inline-flex items-center justify-between py-5 px-6 w-full text-lg">
              <span>Get Started</span>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </a>
            <div className="brutal-card p-6 flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--color-signal)] blur-[50px] opacity-30 group-hover:opacity-60 transition-opacity"></div>
              <Terminal className="w-5 h-5 text-[var(--color-signal)] mb-2" />
              <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">System Status</span>
              <span className="font-[var(--font-display)] text-2xl font-bold text-white">0.05s / CV</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES - Asymmetric Tensions */}
      <section id="features" className="py-32 px-6 md:px-12 border-t border-white/5 bg-[var(--color-bg-panel)] relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 justify-between items-start mb-24">
            <h2 className="font-[var(--font-display)] text-5xl md:text-7xl font-bold uppercase tracking-tighter lg:w-1/2">
              Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#475569]">Pipeline</span>
            </h2>
            <p className="text-lg text-[var(--color-text-muted)] lg:w-1/3 leading-relaxed border-l-2 border-[var(--color-acid)] pl-6">
              We eliminated expensive API bloat. Our 5-stage architecture utilizes fast AI models for the bulk queue, saving deep analysis exclusively for top performers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="brutal-card p-8 group overflow-hidden relative">
              <div className="w-12 h-12 bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:border-[var(--color-acid)] transition-colors">
                <Layers className="text-[var(--color-acid)] w-6 h-6" />
              </div>
              <h3 className="font-[var(--font-display)] text-2xl font-bold mb-4 uppercase text-white">Stage 1-2<br />Zero Cost Triage</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                PyMuPDF OCR + Rule-based filters immediately slaughter 30% of noise (word count, languages) completely free.
              </p>
            </div>

            <div className="brutal-card brutal-card-orange p-8 group relative overflow-hidden">
              <div className="w-12 h-12 bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:border-[var(--color-signal)] transition-colors">
                <Zap className="text-[var(--color-signal)] w-6 h-6" />
              </div>
              <h3 className="font-[var(--font-display)] text-2xl font-bold mb-4 uppercase text-white">Stage 3<br />Coarse Filter</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                Llama 3.1 8B instantly scores candidates 1-10 on JD relevance. Retains only the top 40% for pennies.
              </p>
            </div>

            <div className="brutal-card p-8 group relative overflow-hidden">
              <div className="absolute inset-0 bg-[var(--color-acid)] opacity-0 group-hover:opacity-5 transition-opacity duration-500"></div>
              <div className="w-12 h-12 bg-[var(--color-text-main)] flex items-center justify-center mb-8 border border-white/10 transition-colors">
                <Cpu className="text-black w-6 h-6" />
              </div>
              <h3 className="font-[var(--font-display)] text-2xl font-bold mb-4 uppercase text-white">Stage 4-5<br />Deep Insight</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                Llama 3.3 70B & Web Agents perform brutal gap analysis on the finalists, fetching GitHub and live portfolio stats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING - High Contrast Table styling */}
      <section id="pricing" className="py-32 px-6 md:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-[var(--font-display)] text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-24 text-center">
            Pricing <br />Plans
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-white/10 relative">
            {/* Free Tier */}
            <div className="p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-white/10 bg-[var(--color-bg-dark)] hover:bg-[var(--color-bg-panel)] transition-colors flex flex-col h-full">
              <p className="text-sm font-bold tracking-widest text-[#94A3B8] mb-4 uppercase">Free Tier</p>
              <div className="mb-8">
                <span className="font-[var(--font-display)] text-6xl font-bold">₹0</span>
              </div>
              <ul className="space-y-4 mb-12 text-sm text-[var(--color-text-muted)] flex-grow">
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-40 shrink-0" /> Local Extraction (PDF/DOCX)</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-40 shrink-0" /> Basic Spam Filtering</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-40 shrink-0" /> Llama 8B Coarse scoring (up to 50 CVs)</li>
              </ul>
              <button onClick={() => navigate('/new-job')} className="brutal-button w-full mt-auto">Get Started</button>
            </div>

            {/* Pro Tier - Pops out */}
            <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-black bg-[var(--color-acid)] text-black relative z-10 scale-[1.02] shadow-2xl shadow-[#A3E635]/10 flex flex-col h-full">
              <div className="absolute top-0 right-0 p-3 border-b border-l border-black/10 text-xs font-bold uppercase tracking-wider bg-black text-[var(--color-acid)]">Recommended</div>
              <p className="text-sm font-bold tracking-widest text-black/60 mb-4 uppercase">Pro License</p>
              <div className="mb-8">
                <span className="font-[var(--font-display)] text-6xl font-bold tracking-tighter">₹2k</span>
                <span className="text-sm font-bold opacity-60 uppercase tracking-widest ml-2">/ month</span>
              </div>
              <ul className="space-y-4 mb-12 text-sm font-medium flex-grow">
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-70 shrink-0" /> Infinite Extraction + OCR</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-70 shrink-0" /> Uncapped 8B Bulk Processing</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-70 shrink-0" /> Deep 70B JSON Extraction</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 opacity-70 shrink-0" /> Full Analytics Dashboard</li>
              </ul>
              <button className="brutal-button brutal-button-primary !bg-black !text-[var(--color-acid)] w-full hover:!bg-transparent hover:!text-black hover:border-black mt-auto">Upgrade to Pro</button>
            </div>

            {/* Enterprise */}
            <div className="p-8 md:p-12 bg-[var(--color-bg-dark)] hover:bg-[var(--color-bg-panel)] transition-colors flex flex-col h-full border-t md:border-t-0 md:border-l border-white/10 lg:border-l-0">
              <p className="text-sm font-bold tracking-widest text-[var(--color-signal)] mb-4 uppercase">Enterprise</p>
              <div className="mb-8">
                <span className="font-[var(--font-display)] text-5xl font-bold tracking-tighter">Custom</span>
              </div>
              <ul className="space-y-4 mb-12 text-sm text-[var(--color-text-muted)] flex-grow">
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-white/40 shrink-0" /> Web-Search Enrichment (GitHub/LinkedIn)</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-white/40 shrink-0" /> ATS Integration API</li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-white/40 shrink-0" /> Dedicated Private Instance</li>
              </ul>
              <button className="brutal-button w-full border-white/20 mt-auto">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-32 px-6 md:px-12 border-t border-white/5 bg-[var(--color-bg-panel)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-[var(--font-display)] text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-16 text-white">
            Frequently<br />Asked <span className="text-[var(--color-signal)]">Questions</span>
          </h2>

          <div className="border-t border-white/10">
            {[
              { q: 'How is this faster than standard ATS matching?', a: 'Traditional ATS uses exact-match regex which takes no time but fails contextually. Normal AI APIs take 5-10 seconds per resume. We use local PyMuPDF bypassing API limits, then a fast 8B model to instantly drop bad fits, preserving 70B tokens only for the elite.' },
              { q: 'What happens to the resumes we upload?', a: 'Processed in memory, evaluated, and immediately dumped from our active inference context. We don\'t train on your proprietary applicant data.' },
              { q: 'Can it read scanned PDFs?', a: 'Yes. Pytesseract OCR kicks in automatically if PyMuPDF detects a graphical non-text PDF structure.' },
              { q: 'How does the Web Enrichment work?', a: 'For the top 3 candidates, the agent queries search engines for their GitHub repositories and portfolio URLs automatically, embedding a reality-check summary alongside their CV skills.' }
            ].map((faq, i) => (
              <div key={i} className="border-b border-white/10">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full py-8 flex justify-between items-center text-left focus:outline-none focus:bg-white/5 px-4 -mx-4 transition-colors"
                >
                  <span className="font-[var(--font-display)] text-xl md:text-2xl font-bold pb-0 pr-4">{faq.q}</span>
                  <ChevronDown className={`w-6 h-6 shrink-0 transition-transform duration-300 ${activeFaq === i ? 'rotate-180 text-[var(--color-acid)]' : 'text-slate-600'}`} />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out px-4 -mx-4 ${activeFaq === i ? 'max-h-[500px] opacity-100 pb-8' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-[var(--color-text-muted)] text-lg leading-relaxed max-w-3xl">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA - The "Terminal Block" */}
      <section className="py-0 px-0 md:px-12 md:py-32 bg-[var(--color-bg-dark)] border-t border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto bg-white text-[var(--color-bg-dark)] p-8 md:p-16 border-t-[16px] border-[var(--color-acid)] shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-end gap-12">
            <div>
              <h2 className="font-[var(--font-display)] text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tighter mb-6 leading-none">
                Contact<br />Us
              </h2>
              <p className="text-lg md:text-xl font-medium max-w-md text-slate-700">
                Ready to stop reading 400 page PDFs manually? Reach out to discuss custom Enterprise solutions.
              </p>
            </div>

            <form className="w-full lg:w-1/2 flex flex-col gap-4">
              <input type="email" placeholder="Enter your work email address" className="w-full bg-[#121214] text-[var(--color-acid)] p-5 font-sans text-base border-none focus:outline-none focus:ring-2 focus:ring-[var(--color-acid)] transition-all placeholder:text-slate-500" />
              <textarea placeholder="How can we help you?" rows={4} className="w-full bg-[#121214] text-[var(--color-acid)] p-5 font-sans text-base border-none focus:outline-none focus:ring-2 focus:ring-[var(--color-acid)] transition-all resize-none placeholder:text-slate-500"></textarea>
              <button type="button" onClick={() => navigate('/new-job')} className="brutal-button brutal-button-primary !p-5 text-center">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center text-sm font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-dark)]">
        SYS.OUT // HIREADEV © 2026 // ALL PROCESSES TERMINATED.
      </footer>
    </div>
  );
}
