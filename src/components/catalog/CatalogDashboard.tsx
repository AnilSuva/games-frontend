"use client";

import { useMemo, useState } from "react";
import type { GameCategory, GameMetadata } from "@/platform/registry/types";
import { GameGrid } from "./GameGrid";

interface CatalogDashboardProps {
  games: GameMetadata[];
}

type FilterTab = "all" | GameCategory;

export function CatalogDashboard({ games }: CatalogDashboardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      // Category filter
      if (activeTab !== "all" && game.category !== activeTab) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = game.title.toLowerCase().includes(query);
        const matchesDesc = game.shortDescription.toLowerCase().includes(query);
        const matchesTags = game.tags.some((t) => t.toLowerCase().includes(query));
        return matchesTitle || matchesDesc || matchesTags;
      }
      return true;
    });
  }, [games, activeTab, searchQuery]);

  return (
    <div className="space-y-8 sm:space-y-10 py-2 sm:py-6">
      {/* Calm Platform Introduction */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1c1917]">
          Choose a game
        </h1>
        <p className="text-xs sm:text-sm text-[#6b665f] max-w-lg">
          Minimalist, distraction-free browser games. Tactile controls with instant loading.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "all"
                ? "bg-[#1c1917] text-white shadow-sm"
                : "bg-white border border-[#e6e3dc] text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:border-[#d2cecd] active:bg-[#f0eee9]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("board")}
            className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "board"
                ? "bg-[#1c1917] text-white shadow-sm"
                : "bg-white border border-[#e6e3dc] text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:border-[#d2cecd] active:bg-[#f0eee9]"
            }`}
          >
            Board Games
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("arcade")}
            className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "arcade"
                ? "bg-[#1c1917] text-white shadow-sm"
                : "bg-white border border-[#e6e3dc] text-[#6b665f] sm:hover:text-[#1c1917] sm:hover:border-[#d2cecd] active:bg-[#f0eee9]"
            }`}
          >
            Arcade
          </button>
        </div>

        {/* Quiet Search Box */}
        <div className="relative sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white border border-[#e6e3dc] text-[#1c1917] placeholder-[#9c978e] focus:outline-none focus:border-[#1c1917] transition"
          />
          <svg
            className="w-3.5 h-3.5 text-[#9c978e] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9c978e] hover:text-[#1c1917]"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Game Grid */}
      <GameGrid games={filteredGames} />
    </div>
  );
}
