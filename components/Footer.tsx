'use client';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-[#010120] border-t border-[#ebebeb] dark:border-white/[0.08] pt-12 pb-6 overflow-hidden select-none transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-6">
        {/* Top row: Brand & Legal in monospace uppercase */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 text-[11px] font-mono text-[#6b7280] dark:text-[#959494]">
          <div className="flex items-center space-x-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef2cc1]" />
            <span className="tracking-widest uppercase font-medium">EVEE // AUTONOMOUS OUTBOUND ENGINE</span>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-[#959494]">CANONICAL VERSION 2.0</span>
            <a
              href="https://singulr.tech/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6b7280] dark:text-[#959494] hover:text-[#000000] dark:hover:text-white underline underline-offset-4 transition font-medium"
            >
              PRIVACY POLICY
            </a>
          </div>
        </div>

        {/* Massive Together AI-style Stencil Wordmark Banner */}
        <div className="pt-6 border-t border-[#ebebeb] dark:border-white/[0.05] text-center overflow-hidden">
          <div className="text-[17vw] sm:text-[18vw] font-extrabold tracking-tighter text-[#000000]/[0.05] dark:text-white/[0.03] leading-none uppercase select-none pointer-events-none whitespace-nowrap">
            EVEE.AI
          </div>
        </div>
      </div>
    </footer>
  );
}
