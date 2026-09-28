import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGameMetadata, getAllAvailableGameIds } from "@/platform/registry";
import { GameContainer } from "@/components/game-host/GameContainer";
import { SpinWheel } from "@/games/random-royale/spin-wheel";

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

  // Spin Wheel is a standalone experience that manages its own full-page layout
  // and does not need the shared GameContainer HUD, pause modal, or atmosphere.
  if (game.id === "spin-wheel") {
    return <SpinWheel />;
  }

  return (
    <div className="active-game-page flex-1 flex min-h-0 flex-col w-full">
      <GameContainer game={game} />
    </div>
  );
}
