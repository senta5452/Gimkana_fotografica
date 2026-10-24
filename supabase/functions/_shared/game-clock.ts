export const BONUS_SECONDS = 180;

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

export function getTeamClock(
  game: GameClockRow,
  team: TeamClockRow,
  approvedCount: number,
  nowMs: number,
) {
  const elapsed = getElapsedSeconds(game, nowMs);
  const limit = game.duration_seconds + BONUS_SECONDS * approvedCount;

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