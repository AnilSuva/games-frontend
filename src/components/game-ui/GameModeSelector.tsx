"use client";

import { ReactNode, useState } from "react";
import { DifficultySlider } from "./DifficultySlider";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GameModeOption {
  /** Unique key for this mode (e.g. "1v1", "bot", "multiplayer") */
  id: string;
  /** Display label */
  label: string;
  /** Short description shown on the right side of the button */
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

interface GameModeSelectorProps {
  /** Game title shown in the header */
  gameTitle: string;
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
}

type Screen = "main" | "config";

/**
 * Shared game mode selection overlay.
 * Renders a clean mode-selection surface that works for any game.
 *
 * Supports:
 * - Direct-select modes (e.g., 1v1 → starts immediately)
 * - Configured modes (e.g., Bot → shows difficulty slider → starts)
 * - Disabled modes with badges (e.g., Multiplayer → "Coming Soon")
 */
export function GameModeSelector({
  gameTitle,
  modes,
  onSelectMode,
  onSelectConfiguredMode,
  onScreenChange,
  footer,
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

    if (mode.config) {
      // Navigate to config sub-screen
      setActiveModeId(mode.id);
      setConfigValue(mode.config.defaultValue);
      handleSwitchScreen("config");
    } else {
      // Direct selection
      onSelectMode(mode.id);
    }
  };

  const handleStartConfigured = () => {
    if (activeModeId) {
      onSelectConfiguredMode(activeModeId, configValue);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] aspect-square p-6 bg-white rounded-2xl border border-[#e6e3dc] shadow-sm flex flex-col items-center justify-center text-center">
      {currentScreen === "main" ? (
        <div className="w-full flex flex-col items-center justify-between h-full py-2">
          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[#1c1917]">
              {gameTitle}
            </h2>
            <p className="text-xs text-[#6b665f]">Select game mode</p>
          </div>

          {/* Mode Options */}
          <div className="w-full max-w-xs space-y-2.5 my-auto">
            {modes.map((mode) =>
              mode.disabled ? (
                <button
                  key={mode.id}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="w-full min-h-[50px] py-3 px-4 rounded-xl text-sm font-medium bg-[#faf9f6]/50 border border-[#eeece6] text-[#9c978e] cursor-not-allowed flex items-center justify-between opacity-60"
                >
                  <span>{mode.label}</span>
                  {mode.disabledBadge && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#eeece6] text-[#6b665f]">
                      {mode.disabledBadge}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeClick(mode)}
                  className="w-full min-h-[50px] py-3 px-4 rounded-xl text-sm font-medium bg-[#faf9f6] sm:hover:bg-[#f0eee9] active:bg-[#e7e4dc] border border-[#e6e3dc] sm:hover:border-[#1c1917] text-[#1c1917] transition-colors flex items-center justify-between shadow-xs cursor-pointer"
                >
                  <span className="font-semibold">{mode.label}</span>
                  {mode.description && (
                    <span className="text-xs text-[#6b665f]">
                      {mode.description}
                    </span>
                  )}
                </button>
              )
            )}
          </div>

          {/* Optional footer */}
          {footer}
        </div>
      ) : activeMode?.config ? (
        <div className="w-full flex flex-col items-center justify-between h-full py-2">
          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[#1c1917]">
              {activeMode.config.title || gameTitle}
            </h2>
            {activeMode.config.subtitle && (
              <p className="text-xs text-[#6b665f]">
                {activeMode.config.subtitle}
              </p>
            )}
          </div>

          {/* Difficulty Slider */}
          <div className="w-full max-w-xs my-auto py-2">
            <DifficultySlider
              values={activeMode.config.values}
              value={configValue}
              onChange={setConfigValue}
              label={activeMode.config.sliderLabel ?? "Difficulty"}
            />
          </div>

          {/* Actions */}
          <div className="w-full max-w-xs space-y-2">
            <button
              type="button"
              onClick={handleStartConfigured}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#1c1917] sm:hover:bg-[#322f2c] active:bg-black text-white transition-colors shadow-sm cursor-pointer"
            >
              {activeMode.config.startLabel ?? "Start Match"}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchScreen("main")}
              className="w-full min-h-[36px] py-1.5 text-xs text-[#6b665f] sm:hover:text-[#1c1917] active:text-[#1c1917] transition-colors flex items-center justify-center cursor-pointer"
            >
              ← Back to modes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
