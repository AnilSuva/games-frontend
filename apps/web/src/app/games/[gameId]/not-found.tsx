import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
      <div className="w-12 h-12 rounded-xl bg-[#faf9f6] border border-[#e6e3dc] flex items-center justify-center text-[#1c1917] mb-3 text-xl">
        ⚲
      </div>
      <h2 className="text-xl font-semibold text-[#1c1917] mb-1.5">Game Not Found</h2>
      <p className="text-xs text-[#6b665f] mb-5 leading-relaxed">
        The game cartridge you are looking for does not exist in our catalog or may have been retired.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1c1917] hover:bg-[#322f2c] text-white shadow-xs transition active:scale-[0.98]"
      >
        Back to Games
      </Link>
    </div>
  );
}
