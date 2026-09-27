"use client";

import { useEffect } from "react";
import Link from "next/link";

interface GameErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GameError({ error, reset }: GameErrorProps) {
  useEffect(() => {
    console.error("Game Cartridge Error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
      <div className="w-12 h-12 rounded-xl bg-[#faf9f6] border border-[#e6e3dc] flex items-center justify-center text-[#e0530a] mb-3 text-xl">
        !
      </div>
      <h2 className="text-xl font-semibold text-[#1c1917] mb-1.5">Game Error</h2>
      <p className="text-xs text-[#6b665f] mb-5 leading-relaxed">
        An unexpected error occurred while running this game. The platform shell has isolated the crash.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1c1917] hover:bg-[#322f2c] text-white shadow-xs transition active:scale-[0.98]"
        >
          Try Reloading
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg text-xs font-medium text-[#6b665f] hover:text-[#1c1917] bg-white border border-[#e6e3dc] transition"
        >
          Games
        </Link>
      </div>
    </div>
  );
}
