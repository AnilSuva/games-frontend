"use client";

interface SpinButtonProps {
  isSpinning: boolean;
  hasSpun: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function SpinButton({
  isSpinning,
  hasSpun,
  disabled,
  onClick,
}: SpinButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-1 min-h-10 min-w-40 shrink-0 rounded-xl bg-[#1c1917] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#322f2c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:mt-2 sm:min-h-11 lg:mt-5 lg:min-h-12 lg:min-w-44 lg:px-6 lg:py-3"
    >
      {isSpinning ? "Spinning…" : hasSpun ? "Spin Again" : "Spin the Wheel"}
    </button>
  );
}
