import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "../supabase";

export type JudgeGame = {
  id: string;
  name: string;
  game_code: string;
  status: string;
  duration_seconds?: number;
  created_at?: string;
};

type GameListSectionProps = {
  games: JudgeGame[];
  onOpenGame: (gameId: string) => void;
  onGamesChanged: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  setup: "Preparada",
  active: "En curs",
  paused: "Pausada",
  finished: "Finalitzada",
};

const NAME_MAX = 100;

export default function GameListSection({
  games,
  onOpenGame,
  onGamesChanged,
}: GameListSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const editingGame = games.find((game) => game.id === editingId);
  // La durada només es pot canviar si la partida encara no ha començat.
  const canEditDuration = editingGame?.status === "setup";
  const nameValid =
    editName.trim().length > 0 && editName.trim().length <= NAME_MAX;
  const durationValid =
    !canEditDuration ||
    (/^\d+$/.test(editDuration) &&
      Number(editDuration) >= 1 &&
      Number(editDuration) <= 180);

  function startEditing(game: JudgeGame) {
    setDeleteTarget(null);
    setErrorMessage("");
    setEditingId(game.id);
    setEditName(game.name);
    setEditDuration(String(Math.round((game.duration_seconds ?? 1200) / 60)));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingGame || !nameValid || !durationValid) return;

    setBusy(true);
    setErrorMessage("");

    const changes = canEditDuration
      ? { name: editName.trim(), duration_seconds: Number(editDuration) * 60 }
      : { name: editName.trim() };

    let query = supabase.from("games").update(changes).eq("id", editingGame.id);

    // La durada, només si continua sense començar (per si s'ha iniciat
    // mentrestant des d'una altra pestanya).
    if (canEditDuration) query = query.eq("status", "setup");

    const { data, error } = await query.select("id");

    setBusy(false);

    if (error || !data?.length) {
      console.error("games:", error);
      setErrorMessage(
        canEditDuration && !error
          ? "La partida ja ha començat: la durada no es pot canviar."
          : "No s'han pogut desar els canvis."
      );
      return;
    }

    setEditingId(null);
    onGamesChanged();
  }

  async function handleDelete(gameId: string) {
    setBusy(true);
    setErrorMessage("");

    const { error } = await supabase.functions.invoke("judge-delete-game", {
      body: { gameId },
    });

    setBusy(false);
    setDeleteTarget(null);

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("judge-delete-game:", error.message, detail);
      setErrorMessage("No s'ha pogut esborrar la partida.");
      return;
    }

    onGamesChanged();
  }

  return (
    <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
      <p className="eyebrow">PARTIDES</p>
      <h2>Les meves partides</h2>

      {errorMessage && <p role="alert">{errorMessage}</p>}

      {games.length === 0 ? (
        <p className="muted">
          Encara no tens cap partida. Crea'n una a "Nova partida".
        </p>
      ) : (
        <div className="challenge-list">
          {games.map((game) =>
            editingId === game.id ? (
              <form
                className="sub-panel"
                key={game.id}
                onSubmit={handleSave}
              >
                <label htmlFor={`edit-name-${game.id}`}>Nom de la partida</label>
                <input
                  id={`edit-name-${game.id}`}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={NAME_MAX}
                  required
                  style={{ display: "block", width: "100%", marginBottom: 12 }}
                />

                {canEditDuration ? (
                  <>
                    <label htmlFor={`edit-duration-${game.id}`}>
                      Durada (minuts)
                    </label>
                    <input
                      id={`edit-duration-${game.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={180}
                      step={1}
                      value={editDuration}
                      onChange={(event) => setEditDuration(event.target.value)}
                      style={{ display: "block", width: "100%", marginBottom: 4 }}
                    />
                    {!durationValid && (
                      <p role="alert">Entre 1 i 180 minuts sencers.</p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    La durada no es pot canviar perquè la partida ja ha
                    començat.
                  </p>
                )}

                <div className="review-actions" style={{ marginTop: 12 }}>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busy || !nameValid || !durationValid}
                    style={{ marginTop: 0 }}
                  >
                    {busy ? "Desant..." : "Desar"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setEditingId(null)}
                    style={{ marginTop: 0 }}
                  >
                    Cancel·lar
                  </button>
                </div>
              </form>
            ) : (
              <div className="challenge-row" key={game.id}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{game.name}</strong>
                  <br />
                  <span className="muted">
                    Codi {game.game_code} ·{" "}
                    {STATUS_LABELS[game.status] ?? game.status}
                    {game.duration_seconds &&
                      ` · ${Math.round(game.duration_seconds / 60)} min`}
                    {game.created_at &&
                      ` · ${new Date(game.created_at).toLocaleDateString("ca-ES")}`}
                  </span>
                </span>

                {deleteTarget === game.id ? (
                  <>
                    <span className="muted">Esborrar-la amb totes les fotos?</span>
                    <button
                      className="reject-button"
                      onClick={() => handleDelete(game.id)}
                      disabled={busy}
                    >
                      {busy ? "Esborrant..." : "Sí, esborrar"}
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => setDeleteTarget(null)}
                      disabled={busy}
                      style={{ marginTop: 0 }}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="primary-button"
                      onClick={() => onOpenGame(game.id)}
                      style={{ marginTop: 0 }}
                    >
                      Obrir
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => startEditing(game)}
                      aria-label={`Editar ${game.name}`}
                      style={{ marginTop: 0 }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setEditingId(null);
                        setDeleteTarget(game.id);
                      }}
                      aria-label={`Esborrar ${game.name}`}
                      style={{ marginTop: 0 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}
