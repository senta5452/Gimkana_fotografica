import { Camera, Check } from "lucide-react";
import type { Team } from "../types";
import { formatBonus, formatTime } from "../utils";

type JudgeTeamGridProps = {
  teams: Team[];
  pendingCounts: Record<string, number>;
  running: boolean;
  gameStarted: boolean;
  getDisplayedSeconds: (team: Team) => number;
};

export default function JudgeTeamGrid({
  teams,
  pendingCounts,
  running,
  gameStarted,
  getDisplayedSeconds,
}: JudgeTeamGridProps) {
  return (
    <section className="team-grid">
      {teams.map((team) => {
        const approved = team.challenges.filter(
          (challenge) => challenge.approved
        ).length;
        const progress =
          team.challenges.length > 0
            ? (approved / team.challenges.length) * 100
            : 0;

        return (
          <article className={`team-card team-${team.id}`} key={team.id}>
            <div className="team-card-top">
              <div className="team-label">
                <span className="team-marker" />
                <span>{team.name}</span>
              </div>
              <span className="team-status">
                {team.finished
                  ? team.finishReason
                  : running
                    ? "Jugant"
                    : gameStarted
                      ? "En pausa"
                      : "Preparat"}
              </span>
            </div>

            <div className="timer">
              {formatTime(getDisplayedSeconds(team))}
            </div>

            <div className="team-stats">
              <span>
                <Check size={15} /> {approved}/{team.challenges.length} reptes
              </span>
              <span>
                <Camera size={15} />{" "}
                {pendingCounts[team.id] ?? 0} pendents de revisió
              </span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

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
                    {challenge.bonusSeconds != null && (
                      <span className="muted">
                        {" "}
                        ({formatBonus(challenge.bonusSeconds)})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}