import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "../supabase";

type TeamAccessSectionProps = {
  gameId: string;
  gameCode: string;
};

// Codi de partida i PIN nous dels equips. Els PIN no es poden tornar a
// llegir (es guarden com a hash): si s'han perdut, se'n genera un de nou.
export default function TeamAccessSection({
  gameId,
  gameCode,
}: TeamAccessSectionProps) {
  const [confirmTeam, setConfirmTeam] = useState<"A" | "B" | null>(null);
  const [busyTeam, setBusyTeam] = useState<"A" | "B" | null>(null);
  const [newPins, setNewPins] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  // En canviar de partida, no es mostren els PIN de l'anterior.
  useEffect(() => {
    setNewPins({});
    setConfirmTeam(null);
    setErrorMessage("");
  }, [gameId]);

  async function regenerate(teamKey: "A" | "B") {
    setBusyTeam(teamKey);
    setConfirmTeam(null);
    setErrorMessage("");

    const { data, error } = await supabase.functions.invoke(
      "judge-regenerate-pin",
      { body: { gameId, teamKey } }
    );

    setBusyTeam(null);

    if (error || !data?.pin) {
      const detail =
        error?.context instanceof Response ? await error.context.text() : "";
      console.error("judge-regenerate-pin:", error?.message, detail);
      setErrorMessage("No s'ha pogut generar el PIN nou.");
      return;
    }

    setNewPins((current) => ({ ...current, [teamKey]: data.pin }));
  }

  return (
    <div className="sub-panel" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Accés dels equips</h3>
      <p>
        <strong>Codi de partida:</strong> {gameCode}
      </p>
      <p className="muted">
        Els PIN no es poden tornar a consultar. Si no els tens apuntats,
        genera'n un de nou: l'antic deixarà de servir per entrar, però els
        equips que ja són dins no en sortiran.
      </p>

      {(["A", "B"] as const).map((teamKey) => (
        <div className="challenge-row" key={teamKey}>
          <span style={{ flex: 1 }}>
            <strong>Equip {teamKey}</strong>
            {newPins[teamKey] && (
              <>
                {" "}
                · PIN nou: <strong className="pin-value">{newPins[teamKey]}</strong>
              </>
            )}
          </span>

          {confirmTeam === teamKey ? (
            <>
              <span className="muted">L'antic deixarà de servir.</span>
              <button
                className="reject-button"
                onClick={() => regenerate(teamKey)}
              >
                Sí, generar
              </button>
              <button
                className="secondary-button"
                onClick={() => setConfirmTeam(null)}
                style={{ marginTop: 0 }}
              >
                No
              </button>
            </>
          ) : (
            <button
              className="secondary-button"
              onClick={() => setConfirmTeam(teamKey)}
              disabled={busyTeam !== null}
              style={{ marginTop: 0 }}
            >
              <KeyRound size={15} />
              {busyTeam === teamKey ? "Generant..." : "Generar un PIN nou"}
            </button>
          )}
        </div>
      ))}

      {errorMessage && <p role="alert">{errorMessage}</p>}
    </div>
  );
}
