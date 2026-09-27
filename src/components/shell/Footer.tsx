export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#e6e3dc] py-8 text-center text-xs text-[#9c978e]">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="font-normal text-[#6b665f]">
          OmniPlay — Thoughtful, tactile web games.
        </p>
        <div className="flex items-center gap-3 text-[11px] text-[#9c978e]">
          <span>Lightweight</span>
          <span className="text-[#d2cecd]">•</span>
          <span>Zero Ads</span>
          <span className="text-[#d2cecd]">•</span>
          <span>Instant Play</span>
        </div>
      </div>
    </footer>
  );
}
