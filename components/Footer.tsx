'use client';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-[#08090d] border-t border-[#e5e7eb] dark:border-white/[0.06] pt-12 pb-6 overflow-hidden select-none transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-6">
        {/* Simple top row with Privacy Policy link */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 text-xs font-mono text-[#6b7280] dark:text-[#a1a1aa]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e] shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
            <span className="tracking-widest uppercase">SINGULR TECH • B2B PROSPECTING STUDIO</span>
          </div>
          <div>
            <a
              href="https://singulr.tech/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4b5563] dark:text-[#d4d4d8] hover:text-[#111827] dark:hover:text-white underline underline-offset-4 transition font-medium"
            >
              Privacy Policy
            </a>
          </div>
        </div>

        {/* Substantially bigger EVEE AI spanning the screen */}
        <div className="pt-6 border-t border-[#f3f4f6] dark:border-white/[0.04] text-center overflow-hidden">
          <div className="text-[17vw] sm:text-[18vw] font-extrabold tracking-tighter text-[#111827]/[0.08] dark:text-white/[0.05] leading-none uppercase select-none pointer-events-none whitespace-nowrap">
            EVEE AI
          </div>
        </div>
      </div>
    </footer>
  );
}
