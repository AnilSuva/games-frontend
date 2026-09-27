"use client";

import Link from "next/link";

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
}

export function PauseModal({ isOpen, onResume, onRestart }: PauseModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c1917]/35 backdrop-blur-[2px] animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
    >
      <div className="w-full max-w-xs p-6 rounded-2xl bg-white border border-[#e6e3dc] shadow-xl text-center space-y-5">
        <div>
          <h2 id="pause-modal-title" className="text-lg font-semibold text-[#1c1917]">
            Game Paused
          </h2>
          <p className="text-xs text-[#6b665f] mt-1">Take your time</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onResume}
            className="w-full py-2 px-4 rounded-lg font-medium text-xs bg-[#1c1917] hover:bg-[#322f2c] text-white shadow-sm transition active:scale-[0.98]"
          >
            Resume
          </button>
          <button
            onClick={onRestart}
            className="w-full py-2 px-4 rounded-lg font-medium text-xs bg-[#faf9f6] hover:bg-[#eeece6] text-[#1c1917] border border-[#e6e3dc] transition active:scale-[0.98]"
          >
            Restart
          </button>
          <Link
            href="/"
            className="w-full py-2 px-4 rounded-lg font-medium text-xs text-[#6b665f] hover:text-[#1c1917] transition text-center"
          >
            Exit to Games
          </Link>
        </div>
      </div>
    </div>
  );
}
