import { Trophy } from "lucide-react";
import type { GameResult, TeamKey } from "../../types";

type ResultModalProps = {
  result: GameResult;
  teamKey: TeamKey;
  onSummary: () => void;
  onExit: () => void;
};

// Finestra amb el resultat quan la partida s'acaba.
export default function ResultModal({
  result,
  teamKey,
  onSummary,
  onExit,
}: ResultModalProps) {
  const title = result.draw
    ? "Empat!"
    : result.winnerKey === teamKey
      ? "Heu guanyat!"
      : "Partida finalitzada";

  const message = result.draw
    ? "Els dos equips heu acabat amb el mateix nombre de reptes aprovats."
    : result.byCompletion
      ? `${result.winnerName} ha completat tota la seva llista i guanya la partida.`
      : `${result.winnerName} guanya amb ${result.winnerApproved} reptes aprovats.`;

  return (
    <div className="result-modal-overlay">
      <section
        className="result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-modal-title"
      >
        <div className="result-modal-trophy">
          <Trophy size={38} />
        </div>

        <p className="eyebrow">GIMCANA FOTOGRÀFICA</p>
        <h1 id="result-modal-title">{title}</h1>
        <p className="result-modal-message">{message}</p>

        <div className="result-modal-actions">
          <button
            className="primary-button result-modal-button"
            onClick={onSummary}
            style={{ marginTop: 0 }}
          >
            Resum de la partida
          </button>

          <button
            className="secondary-button result-modal-button"
            onClick={onExit}
            style={{ marginTop: 0 }}
          >
            Tornar a l'inici
          </button>
        </div>
      </section>
    </div>
  );
}
