import type { GameMetadata } from "@/platform/registry/types";
import { GameCard } from "./GameCard";

interface GameGridProps {
  games: GameMetadata[];
}

export function GameGrid({ games }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="py-16 text-center text-[#6b665f] rounded-xl border border-dashed border-[#e6e3dc] bg-white/50">
        <p className="text-sm font-medium text-[#1c1917]">No games match your search.</p>
        <p className="text-xs mt-1 text-[#9c978e]">Try clearing the search query or selecting All.</p>
      </div>
    );
  }

  return (
    <section 
      aria-label="Games catalog"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
    >
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </section>
  );
}
