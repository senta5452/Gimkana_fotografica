import type { Challenge, Team } from "./types";

export const INITIAL_SECONDS = 20 * 60;
export const BONUS_SECONDS = 3 * 60;
export const GAME_STORAGE_KEY = "gimkana-game-state";

export function createTeam(
  id: string,
  name: string,
  challenges: Challenge[] = [],
): Team {
  return {
    id,
    name,
    seconds: INITIAL_SECONDS,
    challenges,
    finished: false,
    finishReason: null,
  };
}

export function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainder
  ).padStart(2, "0")}`;
}