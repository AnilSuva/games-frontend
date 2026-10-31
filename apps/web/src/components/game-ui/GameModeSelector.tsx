"use client";

import { ReactNode, useState } from "react";
import { DifficultySlider } from "./DifficultySlider";
import { soundManager } from "@/platform/audio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GameModeOption {
  /** Unique key for this mode (e.g. "1v1", "bot", "online") */
  id: string;
  /** Display label */
  label: string;
  /** Short description (deprecated in standardized design, ignored) */
  description?: string;
  /** Whether this mode is currently available */
  disabled?: boolean;
  /** Badge text shown when disabled (e.g. "Coming Soon") */
  disabledBadge?: string;
  /**
   * If the mode requires a sub-configuration step (e.g., bot difficulty),
   * provide configuration details here.
   */
  config?: GameModeConfig;
}

export interface GameModeConfig {
  /** Title shown on the configuration sub-screen */
  title: string;
  /** Subtitle / descriptor */
  subtitle?: string;
  /** Ordered list of difficulty values */
  values: readonly string[];
  /** Default value */
  defaultValue: string;
  /** Label for the slider (accessibility) */
  sliderLabel?: string;
  /** Label for the start button */
  startLabel?: string;
}

export interface GameModeSelectorProps {
  /** Game title shown in the header */
  gameTitle: string;
  /** Subtitle text (optional, defaults to "Select game mode") */
  subtitle?: string;
  /** Available game modes */
  modes: GameModeOption[];
  /** Called when a mode without config is directly selected */
  onSelectMode: (modeId: string) => void;
  /** Called when a configured mode is started with the selected config value */
  onSelectConfiguredMode: (modeId: string, configValue: string) => void;
  /** Optional screen change callback for lifecycle tracking */
  onScreenChange?: (screen: "main" | "config") => void;
  /** Optional footer content (e.g., player color legend) */
  footer?: ReactNode;
  /** Optional additional CSS classes */
  className?: string;
}

type Screen = "main" | "config";

/**
 * Standardized OmniPlay game mode selection card.
 *
 * Visual characteristics:
 * - Centered white container/card on warm off-white background
 * - Responsive sizing: max-w-sm on mobile, max-w-md on tablet, max-w-lg on desktop
 * - Rounded corners (rounded-2xl sm:rounded-3xl), subtle border and shadow
 * - Clear, short mode labels with right arrow affordance
 * - 1-tap segmented difficulty selection for Bot mode
 */
export function GameModeSelector({
  gameTitle,
  subtitle = "Select game mode",
  modes,
  onSelectMode,
  onSelectConfiguredMode,
  onScreenChange,
  footer,
  className = "",
}: GameModeSelectorProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>("main");
  const [activeModeId, setActiveModeId] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState<string>("");

  const activeMode = activeModeId
    ? modes.find((m) => m.id === activeModeId)
    : null;

  const handleSwitchScreen = (screen: Screen) => {
    setCurrentScreen(screen);
    onScreenChange?.(screen);
  };

  const handleModeClick = (mode: GameModeOption) => {
    if (mode.disabled) return;
    soundManager.play("buttonClick");

    if (mode.config) {
      setActiveModeId(mode.id);
      setConfigValue(mode.config.defaultValue);
      handleSwitchScreen("config");
    } else {
      onSelectMode(mode.id);
    }
  };

  const handleStartConfigured = () => {
    soundManager.play("buttonClick");
    if (activeModeId) {
      onSelectConfiguredMode(activeModeId, configValue);
    }
  };

  const handleBackToModes = () => {
    soundManager.play("buttonClick");
    handleSwitchScreen("main");
  };

  return (
    <div
      className={`relative z-10 w-full max-w-sm sm:max-w-md mx-auto bg-white border border-[#e6e3dc] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col items-center text-center transition-all ${className}`}
    >
      {currentScreen === "main" ? (
        <div className="w-full flex flex-col items-center space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="w-full space-y-1.5 sm:space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1917]">
              {gameTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#6b665f] font-medium">
              {subtitle}
            </p>
          </div>

          {/* Mode Options List - ONLY clear labels with right-arrow affordance */}
          <div className="w-full max-w-xs sm:max-w-sm mx-auto space-y-3 sm:space-y-3.5">
            {modes.map((mode) =>
              mode.disabled ? (
                <button
                  key={mode.id}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="w-full min-h-[54px] sm:min-h-[58px] py-3.5 sm:py-4 px-5 sm:px-6 rounded-xl sm:rounded-2xl bg-[#faf9f6]/50 border border-[#eeece6] text-[#9c978e] cursor-not-allowed flex items-center justify-between opacity-60 text-left"
                >
                  <span className="text-base sm:text-lg font-medium">{mode.label}</span>
                  {mode.disabledBadge && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#eeece6] text-[#6b665f] font-semibold">
                      {mode.disabledBadge}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeClick(mode)}
                  className="group w-full min-h-[54px] sm:min-h-[58px] py-3.5 sm:py-4 px-5 sm:px-6 rounded-xl sm:rounded-2xl bg-[#faf9f6] hover:bg-[#f0eee9] active:bg-[#e7e4dc] border border-[#e6e3dc] hover:border-[#1c1917] text-[#1c1917] transition-all duration-200 active:scale-[0.98] shadow-2xs flex items-center justify-between cursor-pointer text-left"
                >
                  <span className="text-base sm:text-lg font-semibold tracking-tight text-[#1c1917] group-hover:text-black transition-colors">
                    {mode.label}
                  </span>
                  <span className="text-[#9c978e] group-hover:text-[#1c1917] group-hover:translate-x-1 transition-all text-base sm:text-lg font-bold">
                    →
                  </span>
                </button>
              )
            )}
          </div>

          {/* Optional Footer (e.g. Player Color Legend) */}
          {footer && (
            <div className="w-full max-w-xs sm:max-w-sm mx-auto pt-4 sm:pt-5 border-t border-[#eeece6] flex items-center justify-center">
              {footer}
            </div>
          )}
        </div>
      ) : activeMode?.config ? (
        <div className="w-full flex flex-col items-center space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="w-full space-y-1.5 sm:space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1c1917]">
              {activeMode.config.title || "Select Difficulty"}
            </h2>
            <p className="text-xs sm:text-sm text-[#6b665f] font-medium">
              {activeMode.config.subtitle || "Choose computer skill level"}
            </p>
          </div>

          {/* Difficulty Selection */}
          <div className="w-full max-w-xs sm:max-w-sm mx-auto my-auto py-2">
            {activeMode.config.values.length <= 4 ? (
              <div className="w-full grid grid-cols-3 gap-2 sm:gap-2.5 p-1.5 bg-[#faf9f6] rounded-xl sm:rounded-2xl border border-[#e6e3dc]">
                {activeMode.config.values.map((val) => {
                  const isSelected = configValue === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        if (val !== configValue) {
                          soundManager.play("buttonClick");
                        }
                        setConfigValue(val);
                      }}
                      className={`py-3 px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#1c1917] text-white shadow-xs scale-[1.02]"
                          : "text-[#6b665f] hover:text-[#1c1917] hover:bg-[#f0eee9]"
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            ) : (
              <DifficultySlider
                values={activeMode.config.values}
                value={configValue}
                onChange={setConfigValue}
                label={activeMode.config.sliderLabel ?? "Difficulty"}
              />
            )}
          </div>

          {/* Actions */}
          <div className="w-full max-w-xs sm:max-w-sm mx-auto space-y-3">
            <button
              type="button"
              onClick={handleStartConfigured}
              className="w-full min-h-[50px] sm:min-h-[54px] py-3.5 px-6 rounded-xl sm:rounded-2xl bg-[#1c1917] hover:bg-[#322f2c] active:bg-black text-white font-semibold text-sm sm:text-base tracking-wide transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              {activeMode.config.startLabel ?? "Start Match"}
            </button>

            <button
              type="button"
              onClick={handleBackToModes}
              className="w-full py-2 text-xs sm:text-sm font-semibold text-[#6b665f] hover:text-[#1c1917] transition-colors cursor-pointer"
            >
              ← Back to modes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
