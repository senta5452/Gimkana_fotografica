import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { LibraryChallenge } from "./ChallengeLibraryScreen";
import { formatBonus } from "../utils";

// Text d'un camp de minuts sencers dins d'un interval.
function isValidMinutes(value: string, min: number, max: number) {
  return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
}

type CreatedGame = {
  gameId: string;
  gameCode: string;
  teamA: { pin: string };
  teamB: { pin: string };
};

type CreateGameSectionProps = {
  gameName: string;
  onGameNameChange: (value: string) => void;
  onCreateGame: (
    teamA: string[],
    teamB: string[],
    durationMinutes: number,
    defaultBonusMinutes: number
  ) => void;
  onOpenLibrary: () => void;
  onOpenGame: (gameId: string) => void;
  creating: boolean;
  error: string;
  createdGame: CreatedGame | null;
};

export default function CreateGameSection({
  gameName,
  onGameNameChange,
  onCreateGame,
  onOpenLibrary,
  onOpenGame,
  creating,
  error,
  createdGame,
}: CreateGameSectionProps) {
  const [library, setLibrary] = useState<LibraryChallenge[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [selectedA, setSelectedA] = useState<string[]>([]);
  const [selectedB, setSelectedB] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [defaultBonusMinutes, setDefaultBonusMinutes] = useState("3");

  const durationValid = isValidMinutes(durationMinutes, 1, 180);
  const defaultBonusValid = isValidMinutes(defaultBonusMinutes, 0, 60);

  useEffect(() => {
    async function loadLibrary() {
      const { data, error } = await supabase
        .from("challenge_library")
        .select("id, title, description, bonus_seconds")
        .order("title");

      if (error) {
        console.error("challenge_library:", error);
        setLibraryError("No s'han pogut carregar els reptes de la biblioteca.");
        return;
      }

      setLibrary(data ?? []);
    }

    loadLibrary();
  }, []);

  // Quan es crea una partida, buidem la selecció per a la següent.
  useEffect(() => {
    if (createdGame) {
      setSelectedA([]);
      setSelectedB([]);
    }
  }, [createdGame]);

  function toggle(
    id: string,
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function renderTeamColumn(
    teamKey: "A" | "B",
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    return (
      <fieldset className="sub-panel" style={{ flex: "1 1 260px", minWidth: 0 }}>
        <legend>
          <strong>Reptes de l'equip {teamKey}</strong> ({selected.length})
        </legend>

        <div className="review-actions" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelected(library.map((item) => item.id))}
            style={{ marginTop: 0 }}
          >
            Tots
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelected([])}
            style={{ marginTop: 0 }}
          >
            Cap
          </button>
        </div>

        {library.map((challenge) => (
          <label key={challenge.id} className="choice-row">
            <input
              type="checkbox"
              checked={selected.includes(challenge.id)}
              onChange={() => toggle(challenge.id, setSelected)}
            />
            <span>
              {challenge.title}{" "}
              <span className="muted">
                (
                {challenge.bonus_seconds === null
                  ? defaultBonusValid
                    ? `${formatBonus(Number(defaultBonusMinutes) * 60)}, per defecte`
                    : "per defecte"
                  : formatBonus(challenge.bonus_seconds)}
                )
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    );
  }

  const canCreate =
    !creating &&
    selectedA.length > 0 &&
    selectedB.length > 0 &&
    durationValid &&
    defaultBonusValid;

  return (
    <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
      <p className="eyebrow">NOVA PARTIDA</p>
      <h2>Crea una gimcana</h2>

      <label htmlFor="game-name">Nom de la partida</label>
      <input
        id="game-name"
        value={gameName}
        onChange={(event) => onGameNameChange(event.target.value)}
        maxLength={100}
        style={{ display: "block", width: "100%", marginBottom: 12 }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="game-duration">Durada de la partida (minuts)</label>
          <input
            id="game-duration"
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            step={1}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 4 }}
          />
          {!durationValid && (
            <p role="alert">Entre 1 i 180 minuts sencers.</p>
          )}
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="game-default-bonus">
            Temps per defecte dels reptes (minuts)
          </label>
          <input
            id="game-default-bonus"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            step={1}
            value={defaultBonusMinutes}
            onChange={(event) => setDefaultBonusMinutes(event.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 4 }}
          />
          {!defaultBonusValid && (
            <p role="alert">Entre 0 i 60 minuts sencers.</p>
          )}
        </div>
      </div>

      <p className="muted">
        El temps per defecte s'aplica als reptes de la biblioteca que no en
        tenen un de propi.
      </p>

      {libraryError && <p role="alert">{libraryError}</p>}

      {library.length === 0 ? (
        <p className="muted">
          Encara no tens reptes a la biblioteca. Afegeix-ne abans de crear una
          partida.{" "}
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenLibrary}
          >
            Obrir la biblioteca
          </button>
        </p>
      ) : (
        <>
          <p className="muted">
            Marca els reptes de cada equip (com a mínim un). L'ordre de cada
            llista es barrejarà a l'atzar.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {renderTeamColumn("A", selectedA, setSelectedA)}
            {renderTeamColumn("B", selectedB, setSelectedB)}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelectedB(selectedA)}
            disabled={selectedA.length === 0}
          >
            Copiar els de l'equip A a l'equip B
          </button>
        </>
      )}

      <button
        className="primary-button"
        onClick={() =>
          onCreateGame(
            selectedA,
            selectedB,
            Number(durationMinutes),
            Number(defaultBonusMinutes)
          )
        }
        disabled={!canCreate}
      >
        {creating ? "Creant..." : "Crear partida"}
      </button>

      {error && <p role="alert">{error}</p>}

      {createdGame && (
        <div style={{ marginTop: 20 }}>
          <h3>Partida creada correctament</h3>
          <p>
            <strong>Codi de partida:</strong> {createdGame.gameCode}
          </p>
          <p>
            <strong>PIN de l'equip A:</strong> {createdGame.teamA.pin}
          </p>
          <p>
            <strong>PIN de l'equip B:</strong> {createdGame.teamB.pin}
          </p>
          <p className="muted">
            Guarda aquests PIN: es mostren ara perquè els puguis compartir
            amb els equips.
          </p>
          <button
            className="primary-button"
            onClick={() => onOpenGame(createdGame.gameId)}
          >
            Obrir aquesta partida
          </button>
        </div>
      )}
    </section>
  );
}
