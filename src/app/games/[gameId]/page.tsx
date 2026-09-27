import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGameMetadata, getAllAvailableGameIds } from "@/platform/registry";
import { GameContainer } from "@/components/game-host/GameContainer";

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

/**
 * Pre-generate static routes for all available games at build time.
 */
export async function generateStaticParams() {
  const gameIds = getAllAvailableGameIds();
  return gameIds.map((gameId) => ({ gameId }));
}

/**
 * Dynamic SEO metadata generated per game.
 */
export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { gameId } = await params;
  const game = getGameMetadata(gameId);

  if (!game) {
    return {
      title: "Game Not Found",
      description: "The requested game does not exist on OmniPlay.",
    };
  }

  return {
    title: `${game.title} - Play Free Online`,
    description: game.description,
    openGraph: {
      title: `${game.title} | OmniPlay`,
      description: game.shortDescription,
    },
  };
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params;
  const game = getGameMetadata(gameId);

  if (!game) {
    notFound();
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-6 w-full max-w-5xl mx-auto">
      <GameContainer game={game} />
    </div>
  );
}
