import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const FUNNY_QUOTES = [
  "Reticulating splines...",
  "Warming up the servers...",
  "Feeding the hamsters...",
  "Downloading more RAM...",
  "Calculating the meaning of life...",
  "Spinning the wheels of progress...",
  "Loading the loading screen...",
  "Doing science...",
  "Summoning the data...",
  "Brewing coffee for the developers...",
];

export default function LoadingWheel() {
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * FUNNY_QUOTES.length));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % FUNNY_QUOTES.length);
    }, 3000); // Change quote every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-10 space-y-4 border border-white/10 bg-[#121214]">
      <Loader2 className="w-8 h-8 text-[var(--color-acid)] animate-spin" />
      <div className="text-center font-mono text-sm uppercase tracking-widest text-slate-500 min-h-[1.5rem] transition-opacity duration-300">
        {FUNNY_QUOTES[quoteIndex]}
      </div>
    </div>
  );
}
