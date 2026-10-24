type HomeScreenProps = {
  onJudge: () => void;
  onTeamA: () => void;
  onTeamB: () => void;
};

export default function HomeScreen({
  onJudge,
  onTeamA,
  onTeamB,
}: HomeScreenProps) {
  return (
    <section className="home-screen">
      <header className="home-header">
        <p className="eyebrow">GIMCANA FOTOGRÀFICA</p>
        <h1>Preparats per jugar?</h1>
        <p className="muted">Tria com vols entrar a la partida.</p>
      </header>

      <div className="home-options">
        <button className="home-option" onClick={onJudge}>
          <span className="home-option-icon">⚖️</span>
          <span className="home-option-text">
            <strong>Jutge</strong>
            <small>Controla la partida i valida les fotografies.</small>
          </span>
          <span className="home-arrow">→</span>
        </button>

        <button className="home-option" onClick={onTeamA}>
          <span className="home-option-icon">📸</span>
          <span className="home-option-text">
            <strong>Equip A</strong>
            <small>Consulta els reptes i envia fotografies.</small>
          </span>
          <span className="home-arrow">→</span>
        </button>

        <button className="home-option" onClick={onTeamB}>
          <span className="home-option-icon">📷</span>
          <span className="home-option-text">
            <strong>Equip B</strong>
            <small>Consulta els reptes i envia fotografies.</small>
          </span>
          <span className="home-arrow">→</span>
        </button>
      </div>
    </section>
  );
}