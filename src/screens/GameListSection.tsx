type JudgeGame = {
  id: string;
  name: string;
  game_code: string;
  status: string;
  created_at?: string;
};

type GameListSectionProps = {
  games: JudgeGame[];
  onOpenGame: (gameId: string) => void;
};

const STATUS_LABELS: Record<string, string> = {
  setup: "Preparada",
  active: "En curs",
  paused: "Pausada",
  finished: "Finalitzada",
};

export default function GameListSection({
  games,
  onOpenGame,
}: GameListSectionProps) {
  return (
    <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
      <p className="eyebrow">PARTIDES</p>
      <h2>Les meves partides</h2>

      {games.length === 0 ? (
        <p className="muted">
          Encara no tens cap partida. Crea'n una a "Nova partida".
        </p>
      ) : (
        <div className="challenge-list">
          {games.map((game) => (
            <div className="challenge-row" key={game.id}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{game.name}</strong>
                <br />
                <span className="muted">
                  Codi {game.game_code} ·{" "}
                  {STATUS_LABELS[game.status] ?? game.status}
                  {game.created_at &&
                    ` · ${new Date(game.created_at).toLocaleDateString("ca-ES")}`}
                </span>
              </span>

              <button
                className="primary-button"
                onClick={() => onOpenGame(game.id)}
                style={{ marginTop: 0 }}
              >
                Obrir
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
