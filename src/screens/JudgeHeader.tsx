import { Clock3, Flag } from "lucide-react";

type JudgeHeaderProps = {
  durationSeconds: number | null;
  running: boolean;
  gameStarted: boolean;
  allTeamsFinished: boolean;
};

export default function JudgeHeader({
  durationSeconds,
  running,
  gameStarted,
  allTeamsFinished,
}: JudgeHeaderProps) {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Flag size={24} />
          </div>
          <div>
            <h1>GIMCANA FOTOGRÀFICA</h1>
            <p>Panell de control del monitor</p>
          </div>
        </div>
        <div className={`status-pill ${running ? "live" : ""}`}>
          <span className="status-dot" />
          {allTeamsFinished
            ? "FINALITZADA"
            : running
              ? "EN CURS"
              : gameStarted
                ? "PAUSADA"
                : "PREPARADA"}
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">CENTRE DE CONTROL</p>
          <h2>SJD com a mapa de joc.</h2>
          <p className="muted">
            Supervisa els equips i valida cada repte.
          </p>
        </div>
        <div className="rule-chip">
          <Clock3 size={16} />
          {durationSeconds !== null
            ? `${Math.round(durationSeconds / 60)} min inicials · `
            : ""}
          cada repte aprovat suma el seu temps
        </div>
      </section>
    </>
  );
}