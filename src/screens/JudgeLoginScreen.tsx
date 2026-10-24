type JudgeLoginScreenProps = {
  authLoading: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function JudgeLoginScreen({
  authLoading,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  busy,
  onSubmit,
}: JudgeLoginScreenProps) {
  return (
    <section
      className="team-card"
      style={{ maxWidth: 440, margin: "32px auto", padding: 24 }}
    >
      <p className="eyebrow">ACCÉS RESTRINGIT</p>
      <h1>Inici de sessió del monitor</h1>
      <p className="muted">Entra amb el teu compte de monitor.</p>

      {authLoading ? (
        <p>Comprovant la sessió...</p>
      ) : (
        <form onSubmit={onSubmit}>
          <label htmlFor="judge-email">Correu electrònic</label>
          <input
            id="judge-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
            style={{ display: "block", width: "100%", marginBottom: 16 }}
          />

          <label htmlFor="judge-password">Contrasenya</label>
          <input
            id="judge-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            style={{ display: "block", width: "100%", marginBottom: 16 }}
          />

          {error && <p role="alert">{error}</p>}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Entrant..." : "Iniciar sessió"}
          </button>
        </form>
      )}
    </section>
  );
}