export default function GameLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-4xl mx-auto">
      <div className="w-full bg-white rounded-2xl border border-[#e6e3dc] overflow-hidden shadow-xs animate-pulse">
        {/* Skeleton Top Bar */}
        <div className="h-12 border-b border-[#eeece6] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-[#eeece6]" />
            <div className="w-28 h-4 rounded bg-[#eeece6]" />
          </div>
          <div className="w-14 h-6 rounded bg-[#eeece6]" />
        </div>

        {/* Skeleton Game Canvas Area */}
        <div className="aspect-[4/3] max-w-lg mx-auto flex items-center justify-center p-6">
          <div className="w-full h-full rounded-xl bg-[#faf9f6] border border-[#eeece6] flex flex-col items-center justify-center gap-2.5">
            <div className="w-6 h-6 rounded-full border-2 border-[#1c1917] border-t-transparent animate-spin" />
            <span className="text-[11px] text-[#9c978e]">Loading game...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
