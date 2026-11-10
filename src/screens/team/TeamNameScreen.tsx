type TeamNameScreenProps = {
  teamLabel: "A" | "B";
  name: string;
  onNameChange: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const TEAM_NAME_MAX = 30;

export default function TeamNameScreen({
  teamLabel,
  name,
  onNameChange,
  error,
  busy,
  onSubmit,
}: TeamNameScreenProps) {
  return (
    <section
      className="team-card"
      style={{ maxWidth: 440, margin: "32px auto", padding: 24 }}
    >
      <p className="eyebrow">EQUIP {teamLabel}</p>

      <h1>Com es diu el vostre equip?</h1>

      <p className="muted">
        Aquest nom el veuran el monitor i l'altre equip. El podeu canviar
        cada vegada que entreu, fins que comenci la partida.
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="team-name">Nom de l'equip</label>
        <input
          id="team-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={TEAM_NAME_MAX}
          placeholder="Ex. Els Exploradors"
          autoFocus
          required
          style={{ display: "block", width: "100%", marginBottom: 4 }}
        />
        <p className="muted" style={{ marginTop: 0 }}>
          {name.trim().length}/{TEAM_NAME_MAX} caràcters
        </p>

        {error && <p role="alert">{error}</p>}

        <button
          type="submit"
          className="primary-button"
          disabled={busy || !name.trim()}
        >
          {busy ? "Desant..." : "Continuar"}
        </button>
      </form>
    </section>
  );
}
