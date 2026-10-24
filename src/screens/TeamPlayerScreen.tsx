import { Camera, Check, Clock3, X } from "lucide-react";
import type { Team } from "../types";
import { formatBonus } from "../utils";

type TeamSubmission = {
  id: string;
  challengeId: string;
  status: "pending" | "approved" | "rejected";
  comment: string;
  receivedAt: string;
};

type UploadStatus = {
  kind: "sending" | "ok" | "error";
  text: string;
};

type TeamPlayerScreenProps = {
  team: Team;
  joinedGameName: string;
  timeText: string;
  running: boolean;
  gameStarted: boolean;
  finished: boolean;
  hasPending: boolean;
  submissions: TeamSubmission[];
  uploadStatus: UploadStatus | null;
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
  finished,
  hasPending,
  submissions,
  uploadStatus,
  selectedChallengeId,
  onSelectChallenge,
  onPhotoSelected,
}: TeamPlayerScreenProps) {
  const approved = team.challenges.filter(
    (challenge) => challenge.approved
  ).length;

  const allApproved = team.challenges.every((challenge) => challenge.approved);

  const sending = uploadStatus?.kind === "sending";

  // Motiu del rebuig, si l'últim enviament d'un repte no aprovat s'ha rebutjat.
  function rejectionFor(challengeId: string) {
    const latest = submissions
      .filter((item) => item.challengeId === challengeId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];

    return latest?.status === "rejected" ? latest.comment || "Sense motiu" : null;
  }

  return (
    <article className={`team-card team-${team.id}`}>
      <p className="eyebrow">LA TEVA GIMCANA</p>
      <h1>{team.name}</h1>

      {joinedGameName && (
        <p className="joined-game-name">Partida: {joinedGameName}</p>
      )}

      <div className="timer">{timeText}</div>

      <p>
        {finished
          ? "Partida finalitzada"
          : running
            ? "Partida en curs"
            : gameStarted
              ? "Partida en pausa"
              : "Esperant que el monitor iniciï la partida"}
      </p>

      <h2>Els teus reptes</h2>

      <div className="challenge-list">
        {team.challenges.map((challenge) => {
          const rejection = challenge.approved
            ? null
            : rejectionFor(String(challenge.id));

          return (
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
                {challenge.bonusSeconds != null && (
                  <span className="muted">
                    {" "}
                    ({formatBonus(challenge.bonusSeconds)})
                  </span>
                )}
                {rejection && (
                  <>
                    <br />
                    <small className="rejection-note">
                      <X size={12} /> Foto rebutjada: {rejection}
                    </small>
                  </>
                )}
              </span>
            </div>
          );
        })}
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
          disabled={
            !running || finished || hasPending || allApproved || sending
          }
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
            finished ||
            hasPending ||
            !selectedChallengeId ||
            allApproved ||
            sending
          }
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onPhotoSelected(file);
            }

            event.target.value = "";
          }}
        />

        {!running && !finished && (
          <p>Podràs enviar fotos quan el monitor iniciï la partida.</p>
        )}

        {uploadStatus &&
          (uploadStatus.kind !== "ok" || hasPending) && (
            <p
              className={`upload-status upload-status-${uploadStatus.kind}`}
              role={uploadStatus.kind === "error" ? "alert" : "status"}
            >
              {uploadStatus.text}
            </p>
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