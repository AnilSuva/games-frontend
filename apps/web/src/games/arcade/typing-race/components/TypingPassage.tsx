"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { TypingRaceOnlinePlayer } from "@/platform/multiplayer/types";

export interface TypingPassageProps {
  passageText: string;
  typedText: string;
  onTypedChange: (newTypedText: string, totalKeystrokes: number) => void;
  isRacing: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  myRole: TypingRaceOnlinePlayer | null;
}

interface PassageWord {
  text: string;
  startIndex: number;
  endIndex: number;
}

interface PassageLine {
  lineIndex: number;
  words: PassageWord[];
  startIndex: number;
  endIndex: number;
  text: string;
}

/**
 * Splits a passage into structured lines (approx. 7-8 words each)
 * so that players only see the active line on screen at any time without scrolling.
 */
function computePassageLines(passageText: string, wordsPerLine = 8): PassageLine[] {
  if (!passageText) return [];
  const rawWords = passageText.trim().split(/\s+/);
  const lines: PassageLine[] = [];
  let currentWordIdx = 0;
  let currentCharIdx = 0;

  while (currentWordIdx < rawWords.length) {
    const chunkWords = rawWords.slice(currentWordIdx, currentWordIdx + wordsPerLine);
    const lineStartIndex = currentCharIdx;
    const lineWordTokens: PassageWord[] = [];

    for (let w = 0; w < chunkWords.length; w++) {
      const wText = chunkWords[w];
      const wStart = currentCharIdx;
      const wEnd = wStart + wText.length;
      lineWordTokens.push({
        text: wText,
        startIndex: wStart,
        endIndex: wEnd,
      });
      // Move past word and following space
      currentCharIdx = wEnd + 1;
    }

    const lineEndIndex = currentCharIdx - 1; // Up to end of this line chunk
    lines.push({
      lineIndex: lines.length,
      words: lineWordTokens,
      startIndex: lineStartIndex,
      endIndex: lineEndIndex,
      text: chunkWords.join(" "),
    });

    currentWordIdx += wordsPerLine;
  }

  return lines;
}

export function TypingPassage({
  passageText,
  typedText,
  onTypedChange,
  isRacing,
  isPaused,
  isCompleted,
  myRole,
}: TypingPassageProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);

  // Compute matching prefix length and any error characters
  const { matchingPrefixLength, hasError, errorChars } = useMemo(() => {
    let matchLen = 0;
    const maxLen = Math.min(typedText.length, passageText.length);
    for (let i = 0; i < maxLen; i++) {
      if (typedText[i] === passageText[i]) {
        matchLen++;
      } else {
        break;
      }
    }
    const err = typedText.length > matchLen;
    const errStr = err ? typedText.slice(matchLen) : "";
    return {
      matchingPrefixLength: matchLen,
      hasError: err,
      errorChars: errStr,
    };
  }, [typedText, passageText]);

  // Always keep textarea cursor at the very end so backspace & typing never desync
  const ensureCursorAtEnd = useCallback(() => {
    if (textareaRef.current) {
      const len = textareaRef.current.value.length;
      try {
        textareaRef.current.setSelectionRange(len, len);
      } catch {
        // Safe fallback if element is unfocused
      }
    }
  }, []);

  // Focus textarea when race begins
  useEffect(() => {
    if (isRacing && !isPaused && !isCompleted) {
      textareaRef.current?.focus();
      ensureCursorAtEnd();
    }
  }, [isRacing, isPaused, isCompleted, ensureCursorAtEnd]);

  // Keep cursor pinned to end whenever typedText updates
  useEffect(() => {
    ensureCursorAtEnd();
  }, [typedText, ensureCursorAtEnd]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (!isRacing || isPaused || isCompleted) return;

      // Clean out newlines
      const rawVal = e.target.value.replace(/\r?\n/g, "");

      // If user is typing new characters while already having 2+ uncorrected errors,
      // prevent further error accumulation so they only ever need 1-2 backspaces to fix.
      if (rawVal.length > typedText.length) {
        if (hasError && errorChars.length >= 2) {
          ensureCursorAtEnd();
          return;
        }
      }

      const delta = Math.abs(rawVal.length - typedText.length);
      const added = delta > 0 ? delta : 1;
      const nextKeystrokes = totalKeystrokes + added;

      setTotalKeystrokes(nextKeystrokes);
      onTypedChange(rawVal, nextKeystrokes);
    },
    [
      isRacing,
      isPaused,
      isCompleted,
      typedText.length,
      hasError,
      errorChars.length,
      totalKeystrokes,
      onTypedChange,
      ensureCursorAtEnd,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isRacing || isPaused || isCompleted) {
      e.preventDefault();
      return;
    }

    // Ctrl+Backspace / Cmd+Backspace clears all uncorrected error characters instantly
    if (e.key === "Backspace" && (e.ctrlKey || e.metaKey) && hasError) {
      e.preventDefault();
      const newVal = typedText.slice(0, matchingPrefixLength);
      const nextKeystrokes = totalKeystrokes + Math.max(1, errorChars.length);
      setTotalKeystrokes(nextKeystrokes);
      onTypedChange(newVal, nextKeystrokes);
      return;
    }

    // Prevent Enter from inserting newlines
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }

    // Prevent arrow navigation, home/end from moving cursor away from the typing end
    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowDown" ||
      e.key === "Home" ||
      e.key === "End" ||
      e.key === "PageUp" ||
      e.key === "PageDown"
    ) {
      e.preventDefault();
      ensureCursorAtEnd();
    }
  };

  const handleContainerClick = () => {
    if (textareaRef.current && !isCompleted && isRacing) {
      textareaRef.current.focus();
      ensureCursorAtEnd();
    }
  };

  // Helper for one-click manual backspace (especially useful on mobile or touchscreens)
  const handleManualBackspace = () => {
    if (!isRacing || isPaused || isCompleted || typedText.length === 0) return;
    const newVal = typedText.slice(0, -1);
    const nextKeystrokes = totalKeystrokes + 1;
    setTotalKeystrokes(nextKeystrokes);
    onTypedChange(newVal, nextKeystrokes);
    if (textareaRef.current) {
      textareaRef.current.focus();
      ensureCursorAtEnd();
    }
  };

  // Structured lines of ~7-8 words each
  const lines = useMemo(() => {
    return computePassageLines(passageText, 8);
  }, [passageText]);

  // Determine active single line based on current typing progress
  const activeLineIndex = useMemo(() => {
    if (!lines.length) return 0;
    for (let i = 0; i < lines.length; i++) {
      if (matchingPrefixLength <= lines[i].endIndex) {
        return i;
      }
    }
    return lines.length - 1;
  }, [lines, matchingPrefixLength]);

  const activeLine = lines[activeLineIndex] ?? lines[0];
  const nextLine = lines[activeLineIndex + 1] ?? null;

  const roleBorder =
    myRole === "orange"
      ? "border-orange-500/40 focus-within:border-orange-500"
      : "border-blue-500/40 focus-within:border-blue-500";
  const roleGlow =
    myRole === "orange"
      ? "focus-within:shadow-[0_0_24px_rgba(249,115,22,0.18)]"
      : "focus-within:shadow-[0_0_24px_rgba(59,130,246,0.18)]";
  const roleAccent = myRole === "orange" ? "text-orange-400" : "text-blue-400";

  return (
    <div className="w-full flex flex-col gap-2 select-none">
      {/* Compact single-line passage card (no scrolling required!) */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative w-full p-4 sm:p-5 rounded-2xl bg-slate-900/90 border transition-all duration-200 backdrop-blur-md cursor-text ${roleBorder} ${roleGlow}`}
      >
        {/* Invisible real textarea for native keyboard & IME on desktop/mobile */}
        <textarea
          ref={textareaRef}
          value={typedText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={ensureCursorAtEnd}
          onSelect={ensureCursorAtEnd}
          onKeyUp={ensureCursorAtEnd}
          onFocus={() => {
            setIsFocused(true);
            ensureCursorAtEnd();
          }}
          onBlur={() => setIsFocused(false)}
          onPaste={(e) => e.preventDefault()} // Anti-cheat: disable paste
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          disabled={!isRacing || isPaused || isCompleted}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-auto resize-none z-10 cursor-text"
          aria-label="Race passage typing area"
        />

        {/* 1. Line Progress Header Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2.5 border-b border-slate-800/80 pb-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Line {activeLineIndex + 1} of {lines.length || 1}
          </span>
          <div className="flex items-center gap-1.5">
            {lines.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx < activeLineIndex
                    ? "w-4 bg-emerald-400"
                    : idx === activeLineIndex
                    ? "w-6 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                    : "w-2 bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 2. Active Single Line Display */}
        <div className="font-mono text-lg sm:text-xl md:text-2xl leading-relaxed tracking-wide min-h-[44px] flex items-center flex-wrap">
          {activeLine?.words.map((word, wordIndex) => {
            const isLastWordInLine = wordIndex === activeLine.words.length - 1;
            const spaceIndex = word.endIndex;

            return (
              <span key={`w-${wordIndex}`} className="inline-block whitespace-nowrap mr-2 sm:mr-3 my-0.5">
                {word.text.split("").map((char, charOffset) => {
                  const globalIdx = word.startIndex + charOffset;

                  if (globalIdx < matchingPrefixLength) {
                    // Correctly typed character
                    return (
                      <span
                        key={`c-${globalIdx}`}
                        className="text-emerald-400 font-semibold transition-colors duration-100"
                      >
                        {char}
                      </span>
                    );
                  }

                  if (globalIdx === matchingPrefixLength) {
                    // Active point: either error position or active typing caret
                    if (hasError) {
                      return (
                        <span key={`c-${globalIdx}`} className="relative inline-flex items-center">
                          {/* Visibly render the actual typed error characters so user sees what to backspace */}
                          <span className="bg-rose-500/30 text-rose-200 line-through decoration-rose-500 decoration-2 font-bold px-1 rounded-sm ring-2 ring-rose-500/80 mr-1 animate-pulse">
                            {errorChars}
                          </span>
                          {/* Red pulsing error cursor */}
                          <span className="inline-block w-0.5 h-5 bg-rose-400 animate-pulse align-middle mr-1" />
                          {/* Target character to type */}
                          <span className="underline decoration-wavy decoration-rose-500 text-amber-300 font-bold px-0.5 rounded-sm bg-amber-400/10">
                            {char}
                          </span>
                        </span>
                      );
                    }

                    // Active Caret Indicator
                    return (
                      <span
                        key={`c-${globalIdx}`}
                        className="relative text-slate-100 font-bold bg-amber-400/25 border-b-2 border-amber-400 rounded-xs animate-pulse"
                      >
                        {char}
                      </span>
                    );
                  }

                  // Upcoming unreached character
                  return (
                    <span
                      key={`c-${globalIdx}`}
                      className="text-slate-400/80 transition-colors duration-150"
                    >
                      {char}
                    </span>
                  );
                })}

                {/* Trailing Space Character */}
                {!isLastWordInLine && (
                  <span className="inline-block relative">
                    {spaceIndex < matchingPrefixLength ? (
                      <span className="text-emerald-500/60 font-semibold">&nbsp;</span>
                    ) : spaceIndex === matchingPrefixLength ? (
                      hasError ? (
                        <span className="inline-flex items-center">
                          <span className="bg-rose-500/30 text-rose-200 line-through decoration-rose-500 font-bold px-1 rounded-sm ring-2 ring-rose-500/80 mr-1">
                            {errorChars}
                          </span>
                          <span className="border-b-2 border-rose-400 bg-rose-500/20 px-1 rounded-xs animate-pulse text-xs text-rose-200">
                            ␣
                          </span>
                        </span>
                      ) : (
                        <span className="border-b-2 border-amber-400 bg-amber-400/25 px-1 rounded-xs animate-pulse text-xs text-amber-200">
                          ␣
                        </span>
                      )
                    ) : (
                      <span className="text-slate-600">&nbsp;</span>
                    )}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* 3. Upcoming Line Preview */}
        {nextLine ? (
          <div className="text-xs sm:text-sm font-mono text-slate-500/80 mt-2.5 truncate flex items-center gap-1.5 border-t border-slate-800/60 pt-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              Next
            </span>
            <span className="truncate">{nextLine.text}</span>
          </div>
        ) : (
          <div className="text-xs font-mono text-emerald-400/80 mt-2.5 flex items-center gap-1.5 border-t border-slate-800/60 pt-2">
            <span>🏁</span>
            <span>Final stretch — push across the checkered finish line!</span>
          </div>
        )}

        {/* Unfocused helper overlay */}
        {!isFocused && isRacing && !isCompleted && !isPaused && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center p-4 z-20 pointer-events-none transition-opacity duration-200">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm font-medium shadow-xl">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Click or tap here to focus keyboard & race!
            </div>
          </div>
        )}
      </div>

      {/* Real-time Status / Mistake alert feedback banner */}
      <div className="flex items-center justify-between text-xs sm:text-sm px-1 min-h-[28px]">
        {hasError ? (
          <div className="flex items-center gap-2 text-rose-400 font-medium">
            <svg
              className="w-4 h-4 text-rose-500 shrink-0 animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Mistake typed:{" "}
              <span className="font-bold font-mono text-rose-200 bg-rose-950/80 px-1 py-0.5 rounded border border-rose-500/40">
                {errorChars === " " || errorChars.trim() === "" ? "[Space]" : `"${errorChars}"`}
              </span>{" "}
              — press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[11px]">
                Backspace
              </kbd>{" "}
              to delete!
            </span>
            <button
              type="button"
              onClick={handleManualBackspace}
              className="ml-1 px-2 py-0.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white font-mono text-xs font-semibold shadow transition-all active:scale-95"
              title="Click to backspace error"
            >
              ⌫ Delete
            </button>
          </div>
        ) : isCompleted ? (
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Finish line crossed! Great race!</span>
          </div>
        ) : isRacing ? (
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Race in progress — type cleanly to maximize car acceleration</span>
          </div>
        ) : (
          <div className="text-slate-400">
            Get your fingers ready on the keyboard!
          </div>
        )}

        <div className="hidden sm:flex items-center gap-1 text-slate-400 font-mono text-xs">
          <span>Role:</span>
          <span className={`font-semibold capitalize ${roleAccent}`}>{myRole ?? "Spectator"}</span>
        </div>
      </div>
    </div>
  );
}
