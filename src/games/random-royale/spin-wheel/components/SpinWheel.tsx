"use client";

import { useSpinWheel } from "../hooks/useSpinWheel";
import { WheelDisplay } from "./WheelDisplay";
import { SpinButton } from "./SpinButton";
import { WinnerDisplay } from "./WinnerDisplay";
import { ParticipantList } from "./ParticipantList";
import { ParticipantInput } from "./ParticipantInput";
import { GameHUD } from "@/components/game-host/GameHUD";

export function SpinWheel() {
  const {
    participants,
    name,
    setName,
    rotation,
    spinDuration,
    isSpinning,
    winner,
    hasSpun,
    segments,
    canSpin,
    isFull,
    addDisabled,
    handleAdd,
    handleRemove,
    handleClear,
    handleReset,
    handleSpin,
    handleSpinEnd,
  } = useSpinWheel();

  return (
    <div className="spin-wheel-page active-game-page flex w-full flex-1 flex-col">
      <div className="active-game-shell relative flex w-full flex-1 flex-col bg-[#f7f6f2]">
        <GameHUD
          onRestart={handleReset}
          showReset={!isSpinning && (participants.length > 0 || hasSpun || rotation !== 0)}
        />
        <div className="active-game-stage w-full">
          <main className="spin-wheel-layout mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-4 px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-3 sm:gap-6 sm:px-6 sm:pt-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-8 lg:px-10 lg:py-6">
            <header className="hidden items-end justify-between gap-3 lg:col-span-2 lg:flex">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b35d35]">
                  Random Royale
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1c1917] sm:text-3xl">
                  Spin Wheel
                </h1>
                <p className="mt-1 max-w-xl text-sm text-[#6b665f]">
                  Add everyone in the draw, then let the wheel choose one winner.
                </p>
              </div>
              <p className="text-xs text-[#817a71]">A fair pick, every spin.</p>
            </header>

            <section
              className="order-1 flex min-w-0 flex-col items-center justify-center lg:order-1"
              aria-label="Spin wheel"
            >
              <WheelDisplay
                participants={participants}
                segments={segments}
                rotation={rotation}
                spinDuration={spinDuration}
                isSpinning={isSpinning}
                winnerId={winner?.id}
                onSpin={handleSpin}
                onSpinEnd={handleSpinEnd}
              />

              <SpinButton
                isSpinning={isSpinning}
                hasSpun={hasSpun}
                disabled={!canSpin}
                onClick={handleSpin}
              />

              <WinnerDisplay winner={winner} isSpinning={isSpinning} />
            </section>

            <section
              className="order-2 mx-auto flex w-full max-w-xl flex-col rounded-2xl border border-[#e6e3dc] bg-white p-3 sm:p-5 lg:order-2"
              aria-labelledby="participants-title"
            >
              <ParticipantList
                participants={participants}
                winnerId={winner?.id}
                isSpinning={isSpinning}
                onRemove={handleRemove}
                onClear={handleClear}
              >
                <ParticipantInput
                  name={name}
                  onNameChange={setName}
                  onSubmit={handleAdd}
                  disabled={addDisabled}
                  isFull={isFull}
                />
              </ParticipantList>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
