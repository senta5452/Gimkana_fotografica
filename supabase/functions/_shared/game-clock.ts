// Temps que afegeix un repte si la fila no en té (reptes antics).
const DEFAULT_BONUS_SECONDS = 180;

type GameClockRow = {
  status: string;
  duration_seconds: number;
  clock_started_at: string | null;
  elapsed_seconds: number;
};

type TeamClockRow = {
  finished_at: string | null;
  finish_reason: string | null;
  finish_elapsed_seconds: number | null;
};

export function getElapsedSeconds(game: GameClockRow, nowMs: number) {
  if (game.status === "active" && game.clock_started_at) {
    const running =
      (nowMs - new Date(game.clock_started_at).getTime()) / 1000;

    return game.elapsed_seconds + Math.max(0, running);
  }

  return game.elapsed_seconds;
}

// Suma del temps que afegeixen els reptes aprovats d'un equip.
export function getApprovedBonusSeconds(
  challenges: { approved: boolean; bonus_seconds?: number | null }[],
) {
  return challenges
    .filter((challenge) => challenge.approved)
    .reduce(
      (total, challenge) =>
        total + (challenge.bonus_seconds ?? DEFAULT_BONUS_SECONDS),
      0,
    );
}

export function getTeamClock(
  game: GameClockRow,
  team: TeamClockRow,
  approvedBonusSeconds: number,
  nowMs: number,
) {
  const elapsed = getElapsedSeconds(game, nowMs);
  const limit = game.duration_seconds + approvedBonusSeconds;

  if (team.finished_at) {
    const finishedAt = team.finish_elapsed_seconds ?? elapsed;

    return {
      gameStatus: game.status,
      finished: true,
      finishReason: team.finish_reason,
      remainingSeconds: Math.max(0, limit - finishedAt),
    };
  }

  const remaining = Math.max(0, limit - elapsed);

  if (game.status !== "setup" && remaining <= 0) {
    return {
      gameStatus: game.status,
      finished: true,
      finishReason: "timeout",
      remainingSeconds: 0,
    };
  }

  return {
    gameStatus: game.status,
    finished: false,
    finishReason: null,
    remainingSeconds: remaining,
  };
}

type ResultTeam = {
  key: string;
  name: string;
  approvedCount: number;
  clock: { finished: boolean; finishReason: string | null };
};

// Resultat de la partida segons les regles del joc: el primer equip que
// completa la llista guanya; si tots dos s'han quedat sense temps, guanya qui
// té més reptes aprovats, i si empaten és empat.
export function getGameResult(gameStatus: string, teams: ResultTeam[]) {
  const over =
    gameStatus === "finished" ||
    (teams.length > 0 && teams.every((team) => team.clock.finished));

  if (!over) {
    return {
      over: false,
      draw: false,
      byCompletion: false,
      winnerKey: null,
      winnerName: null,
      winnerApproved: 0,
    };
  }

  const completed = teams.find(
    (team) => team.clock.finishReason === "completed",
  );

  if (completed) {
    return {
      over: true,
      draw: false,
      byCompletion: true,
      winnerKey: completed.key,
      winnerName: completed.name,
      winnerApproved: completed.approvedCount,
    };
  }

  const [first, second] = [...teams].sort(
    (a, b) => b.approvedCount - a.approvedCount,
  );

  if (!first || (second && second.approvedCount === first.approvedCount)) {
    return {
      over: true,
      draw: true,
      byCompletion: false,
      winnerKey: null,
      winnerName: null,
      winnerApproved: first?.approvedCount ?? 0,
    };
  }

  return {
    over: true,
    draw: false,
    byCompletion: false,
    winnerKey: first.key,
    winnerName: first.name,
    winnerApproved: first.approvedCount,
  };
}
