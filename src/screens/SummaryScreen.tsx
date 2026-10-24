import { Check } from "lucide-react";
import type { Team, Submission } from "../types";

type SummaryScreenProps = {
  team: Team;
  submissions: Submission[];
  teamWon: boolean;
  isDraw: boolean;
  onBack: () => void;
};

export default function SummaryScreen({
  team,
  submissions,
  teamWon,
  isDraw,
  onBack,
}: SummaryScreenProps) {
  const teamSubmissions = submissions
    .filter((item) => item.teamId === team.id)
    .sort((a, b) => a.receivedAt - b.receivedAt);

  const approvedChallenges = team.challenges.filter(
    (challenge) => challenge.approved
  ).length;

  return (
    <section className="team-summary">
      <header className="summary-header">
        <p className="eyebrow">GIMCANA FOTOGRÀFICA</p>
        <h1>Resum de {team.name}</h1>
        <p>
          {isDraw
            ? "La partida ha acabat en empat."
            : teamWon
              ? "Enhorabona! Heu guanyat la gimcana."
              : "La partida ha finalitzat. Gràcies per jugar!"}
        </p>
      </header>

      <div className="summary-stats">
        <article className="summary-stat">
          <strong>
            {approvedChallenges}/{team.challenges.length}
          </strong>
          <span>Reptes aprovats</span>
        </article>

        <article className="summary-stat">
          <strong>
            {teamSubmissions.filter((item) => item.status === "approved").length}
          </strong>
          <span>Fotos aprovades</span>
        </article>

        <article className="summary-stat">
          <strong>
            {teamSubmissions.filter((item) => item.status === "rejected").length}
          </strong>
          <span>Fotos rebutjades</span>
        </article>
      </div>

      <h2>Els teus reptes</h2>

      <div className="challenge-list">
        {team.challenges.map((challenge) => (
          <div className="challenge-row" key={challenge.id}>
            <span
              className={`challenge-check ${
                challenge.approved ? "completed" : ""
              }`}
            >
              {challenge.approved ? <Check size={14} /> : challenge.id}
            </span>

            <span className={challenge.approved ? "done-text" : ""}>
              {challenge.title}
            </span>
          </div>
        ))}
      </div>

      <h2>Fotografies enviades</h2>

      {teamSubmissions.length === 0 ? (
        <p className="muted">No heu enviat cap fotografia.</p>
      ) : (
        <div className="summary-photos">
          {teamSubmissions.map((submission) => (
            <article className="summary-photo" key={submission.id}>
              <img
                src={submission.photoUrl}
                alt={`Foto del repte ${submission.title}`}
              />

              <div>
                <strong>{submission.title}</strong>
                <p>
                  {submission.status === "approved"
                    ? "✓ Aprovada"
                    : submission.status === "rejected"
                      ? "✕ Rebutjada"
                      : "◷ Pendent de revisió"}
                </p>

                {submission.status === "rejected" && submission.comment && (
                  <p>Motiu: {submission.comment}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <button className="secondary-button" onClick={onBack}>
        ← Tornar a l'inici
      </button>
    </section>
  );
}