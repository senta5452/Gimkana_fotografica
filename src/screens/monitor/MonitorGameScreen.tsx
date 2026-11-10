import { Pause, Play, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { useMonitorGame } from "../../hooks/useMonitorGame";
import type { MonitorGame } from "../../types";
import MonitorHeader from "./MonitorHeader";
import TeamAccessSection from "./TeamAccessSection";
import MonitorMessagesSection from "./MonitorMessagesSection";
import MonitorTeamGrid from "./MonitorTeamGrid";
import ModerationSection from "./ModerationSection";

type MonitorGameScreenProps = {
  gameId: string;
  // Fila de la llista de partides (nom i codi); pot trigar a arribar.
  game: MonitorGame | undefined;
  onBack: () => void;
};

// Panell d'una partida: accés dels equips, resultat, missatges, equips,
// moderació de fotos i control del rellotge.
export default function MonitorGameScreen({
  gameId,
  game,
  onBack,
}: MonitorGameScreenProps) {
  const panel = useMonitorGame(gameId);
  const result = panel.result;

  return (
    <>
      <MonitorHeader
        durationSeconds={panel.durationSeconds}
        running={panel.running}
        gameStarted={panel.started}
        allTeamsFinished={panel.allFinished}
      />

      <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
        <button className="secondary-button" onClick={onBack}>
          ← Les meves partides
        </button>
        <p className="eyebrow" style={{ marginTop: 20 }}>
          PARTIDA
        </p>
        <h2>{game?.name ?? "Partida"}</h2>
        {game && <TeamAccessSection gameId={game.id} gameCode={game.game_code} />}
      </section>

      {result?.over && (
        <section className="result-banner" role="status">
          <Trophy size={28} />
          <div>
            <strong>
              {result.draw ? "Empat!" : `${result.winnerName} guanya la partida`}
            </strong>
            <p>
              {result.draw
                ? "Els dos equips han acabat amb el mateix nombre de reptes aprovats."
                : result.byCompletion
                  ? "Ha completat tota la seva llista de reptes."
                  : `Ha acabat amb més reptes aprovats (${result.winnerApproved}).`}
            </p>
          </div>
        </section>
      )}

      <MonitorMessagesSection
        gameId={gameId}
        messages={panel.messages}
        teamNames={Object.fromEntries(
          panel.teams.map((team) => [team.id, team.name])
        )}
        onSent={panel.load}
      />

      <MonitorTeamGrid
        teams={panel.teams}
        pendingCounts={panel.pendingCounts}
        running={panel.running}
        gameStarted={panel.started}
        getDisplayedSeconds={(team) => team.seconds}
      />

      <ModerationSection
        submissions={panel.submissions}
        onReview={panel.review}
      />

      <section className="control-bar">
        <div className="control-copy">
          <ShieldCheck size={21} />
          <div>
            <strong>Control de partida</strong>
            <span>Cada repte aprovat suma a l'equip el temps que té assignat.</span>
          </div>
        </div>

        <div className="control-actions">
          <button
            className="primary-button"
            onClick={panel.startOrPause}
            disabled={!panel.loaded || panel.allFinished}
          >
            {panel.running ? <Pause size={17} /> : <Play size={17} />}
            {panel.running ? "Pausar" : panel.started ? "Reprendre" : "Iniciar"}
          </button>
          <button
            className="secondary-button"
            onClick={panel.reset}
            disabled={!panel.loaded}
          >
            <RotateCcw size={16} />
            Reiniciar
          </button>
        </div>
      </section>
    </>
  );
}
