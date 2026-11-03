export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[#e8e9e5] dark:border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#777a74] dark:text-[#a2a69e]">
        <span>Evee · Outreach workspace</span>
        <a href="https://singulr.tech/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#20211f] dark:hover:text-white transition">Privacy</a>
      </div>
    </footer>
  );
}
