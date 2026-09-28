import { getAllGames } from "@/platform/registry";
import { CatalogDashboard } from "@/components/catalog/CatalogDashboard";

export default function HomePage() {
  const games = getAllGames();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full flex-1">
      <CatalogDashboard games={games} />
    </div>
  );
}
