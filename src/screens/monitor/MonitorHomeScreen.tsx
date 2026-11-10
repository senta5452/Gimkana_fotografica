import { useState } from "react";
import { BookOpen } from "lucide-react";
import { callFunction } from "../../lib/callFunction";
import type { CreatedGame, MonitorGame } from "../../types";
import GameListSection from "./GameListSection";
import CreateGameSection from "./CreateGameSection";

type MonitorHomeScreenProps = {
  games: MonitorGame[];
  onOpenGame: (gameId: string) => void;
  onGamesChanged: () => void;
  onOpenLibrary: () => void;
};

// Inici del monitor: les seves partides, crear-ne una de nova i la
// biblioteca de reptes.
export default function MonitorHomeScreen({
  games,
  onOpenGame,
  onGamesChanged,
  onOpenLibrary,
}: MonitorHomeScreenProps) {
  const [gameName, setGameName] = useState("Nova gimcana");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdGame, setCreatedGame] = useState<CreatedGame | null>(null);

  async function handleCreateGame(
    teamA: string[],
    teamB: string[],
    durationMinutes: number,
    defaultBonusMinutes: number
  ) {
    setCreating(true);
    setError("");
    setCreatedGame(null);

    const { data, error: callError } = await callFunction<CreatedGame>(
      "create-game",
      {
        name: gameName.trim() || "Nova gimcana",
        teamA,
        teamB,
        durationMinutes,
        defaultBonusMinutes,
      },
      "No s'ha pogut crear la partida. Comprova la connexió i torna-ho a provar."
    );

    setCreating(false);

    if (callError || !data?.gameCode || !data.teamA?.pin || !data.teamB?.pin) {
      setError(
        callError ??
          "No s'ha pogut crear la partida. Comprova la connexió i torna-ho a provar."
      );
      return;
    }

    setCreatedGame(data);
    onGamesChanged();
  }

  return (
    <>
      <GameListSection
        games={games}
        onOpenGame={onOpenGame}
        onGamesChanged={onGamesChanged}
      />

      <CreateGameSection
        gameName={gameName}
        onGameNameChange={setGameName}
        onCreateGame={handleCreateGame}
        onOpenLibrary={onOpenLibrary}
        onOpenGame={onOpenGame}
        creating={creating}
        error={error}
        createdGame={createdGame}
      />

      <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
        <p className="eyebrow">BIBLIOTECA</p>
        <h2>Reptes de la biblioteca</h2>
        <p className="muted">
          Crea, edita i esborra els reptes que després triaràs per a cada partida.
        </p>
        <button className="primary-button" onClick={onOpenLibrary}>
          <BookOpen size={17} />
          Obrir la biblioteca
        </button>
      </section>
    </>
  );
}
