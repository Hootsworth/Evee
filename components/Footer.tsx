'use client';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#e5e7eb] pt-12 pb-8 overflow-hidden select-none">
      <div className="max-w-7xl mx-auto px-6">
        {/* Simple top row with Privacy Policy link */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 text-xs font-mono text-[#6b7280]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]"></span>
            <span className="tracking-widest uppercase">SINGULR TECH • B2B PROSPECTING STUDIO</span>
          </div>
          <div>
            <a
              href="https://singulr.tech/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4b5563] hover:text-[#111827] underline underline-offset-4 transition font-medium"
            >
              Privacy Policy
            </a>
          </div>
        </div>

        {/* Substantially bigger EVEE AI spanning the screen */}
        <div className="pt-4 border-t border-[#f3f4f6] text-center overflow-hidden">
          <h2 className="text-[13vw] sm:text-[14vw] font-light tracking-tighter text-[#111827] leading-none uppercase select-none pointer-events-none whitespace-nowrap">
            EVEE AI
          </h2>
        </div>
      </div>
    </footer>
  );
}
