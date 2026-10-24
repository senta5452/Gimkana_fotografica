import { Camera, Check, Clock3 } from "lucide-react";
import type { Team } from "../types";

type TeamPlayerScreenProps = {
  team: Team;
  joinedGameName: string;
  timeText: string;
  running: boolean;
  gameStarted: boolean;
  hasPending: boolean;
  selectedChallengeId: string;
  onSelectChallenge: (value: string) => void;
  onPhotoSelected: (file: File) => void;
};

export default function TeamPlayerScreen({
  team,
  joinedGameName,
  timeText,
  running,
  gameStarted,
  hasPending,
  selectedChallengeId,
  onSelectChallenge,
  onPhotoSelected,
}: TeamPlayerScreenProps) {
  const approved = team.challenges.filter(
    (challenge) => challenge.approved
  ).length;

  const allApproved = team.challenges.every((challenge) => challenge.approved);

  return (
    <article className={`team-card team-${team.id}`}>
      <p className="eyebrow">LA TEVA GIMCANA</p>
      <h1>{team.name}</h1>

      {joinedGameName && (
        <p className="joined-game-name">Partida: {joinedGameName}</p>
      )}

      <div className="timer">{timeText}</div>

      <p>
        {team.finished
          ? "Partida finalitzada"
          : running
            ? "Partida en curs"
            : gameStarted
              ? "Partida en pausa"
              : "Esperant que el jutge iniciï la partida"}
      </p>

      <h2>Els teus reptes</h2>

      <div className="challenge-list">
        {team.challenges.map((challenge) => (
          <div className="challenge-row" key={challenge.id}>
            <span
              className={`challenge-check ${
                challenge.approved ? "completed" : ""
              }`}
            >
              {challenge.approved ? <Check size={14} /> : "•"}
            </span>

            <span className={challenge.approved ? "done-text" : ""}>
              {challenge.title}
            </span>
          </div>
        ))}
      </div>

      <p>
        Reptes aprovats: {approved}/{team.challenges.length}
      </p>

      <div className="team-upload">
        <h2>Envia una fotografia</h2>

        <label htmlFor={`challenge-${team.id}`}>Tria el repte</label>

        <select
          id={`challenge-${team.id}`}
          value={selectedChallengeId}
          onChange={(event) => onSelectChallenge(event.target.value)}
          disabled={!running || team.finished || hasPending || allApproved}
        >
          <option value="">Tria un repte</option>

          {team.challenges
            .filter((challenge) => !challenge.approved)
            .map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.title}
              </option>
            ))}
        </select>

        <label htmlFor={`photo-${team.id}`} className="photo-upload-button">
          <Camera size={20} />
          <span>Fer una fotografia</span>
        </label>

        <input
          id={`photo-${team.id}`}
          className="photo-upload-input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={
            !running ||
            team.finished ||
            hasPending ||
            !selectedChallengeId ||
            allApproved
          }
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onPhotoSelected(file);
            }

            event.target.value = "";
          }}
        />

        {!running && !team.finished && (
          <p>Podràs enviar fotos quan el jutge iniciï la partida.</p>
        )}
      </div>

      {hasPending && (
        <p>
          <Clock3 size={16} /> Tens una fotografia pendent de validació.
        </p>
      )}
    </article>
  );
}