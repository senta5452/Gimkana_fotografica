type TeamLoginScreenProps = {
  teamLabel: "A" | "B";
  gameCode: string;
  onGameCodeChange: (value: string) => void;
  pin: string;
  onPinChange: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function TeamLoginScreen({
  teamLabel,
  gameCode,
  onGameCodeChange,
  pin,
  onPinChange,
  error,
  busy,
  onSubmit,
}: TeamLoginScreenProps) {
  return (
    <section
      className="team-card"
      style={{ maxWidth: 440, margin: "32px auto", padding: 24 }}
    >
      <p className="eyebrow">ACCÉS DE L'EQUIP</p>

      <h1>Entrar com a Equip {teamLabel}</h1>

      <p className="muted">
        Introdueix el codi de partida i el PIN que t'ha donat el monitor.
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="game-code">Codi de partida</label>
        <input
          id="game-code"
          value={gameCode}
          onChange={(event) => onGameCodeChange(event.target.value)}
          placeholder="Ex. TVZ9WAGX"
          autoCapitalize="characters"
          required
          style={{ display: "block", width: "100%", marginBottom: 16 }}
        />

        <label htmlFor="team-pin">PIN de l'equip</label>
        <input
          id="team-pin"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(event) => onPinChange(event.target.value)}
          placeholder="Introdueix el PIN"
          required
          style={{ display: "block", width: "100%", marginBottom: 16 }}
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Comprovant..." : "Entrar a la partida"}
        </button>
      </form>
    </section>
  );
}