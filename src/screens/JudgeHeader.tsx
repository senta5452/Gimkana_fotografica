import { Clock3, Flag, LogOut } from "lucide-react";

type JudgeHeaderProps = {
  running: boolean;
  gameStarted: boolean;
  allTeamsFinished: boolean;
  onLogout: () => void;
};

export default function JudgeHeader({
  running,
  gameStarted,
  allTeamsFinished,
  onLogout,
}: JudgeHeaderProps) {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Flag size={24} />
          </div>
          <div>
            <h1>GIMKANA FOTOGRÀFICA</h1>
            <p>Panel de control del monitor</p>
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
        <button className="secondary-button" onClick={onLogout}>
          <LogOut size={16} />
          Tancar sessió
        </button>
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
          20 min inicials · +3 min por foto
        </div>
      </section>
    </>
  );
}