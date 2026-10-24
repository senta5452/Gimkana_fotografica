type CreatedGame = {
  gameId: string;
  gameCode: string;
  teamA: { pin: string };
  teamB: { pin: string };
};

type CreateGameSectionProps = {
  gameName: string;
  onGameNameChange: (value: string) => void;
  onCreateGame: () => void;
  creating: boolean;
  error: string;
  createdGame: CreatedGame | null;
};

export default function CreateGameSection({
  gameName,
  onGameNameChange,
  onCreateGame,
  creating,
  error,
  createdGame,
}: CreateGameSectionProps) {
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

      <button
        className="primary-button"
        onClick={onCreateGame}
        disabled={creating}
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
        </div>
      )}
    </section>
  );
}