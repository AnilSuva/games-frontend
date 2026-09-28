import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e6e3dc] bg-[#f7f6f2]/90 backdrop-blur-md transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <Link 
          href="/" 
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917] rounded-md py-1"
          aria-label="OmniPlay Home"
        >
          {/* Subtle dual-color player emblem */}
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e0530a]" title="Player 1" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" title="Player 2" />
          </div>

          <span className="text-base sm:text-lg font-semibold tracking-tight text-[#1c1917]">
            OmniPlay
          </span>
        </Link>

        {/* Minimal Navigation */}
        <nav className="flex items-center gap-4 text-xs sm:text-sm font-medium text-[#6b665f]">
          <Link
            href="/"
            className="hover:text-[#1c1917] transition-colors py-1"
          >
            Games
          </Link>
          <span className="text-[#d2cecd] select-none">/</span>
          <span className="text-[11px] font-mono text-[#9c978e]">v0.1</span>
        </nav>
      </div>
    </header>
  );
}
