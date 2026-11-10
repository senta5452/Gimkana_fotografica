import { useEffect, useRef, useState } from "react";
import { callFunction } from "../lib/callFunction";
import { keepPhotoUrls, type PhotoUrlCache } from "../lib/photoUrlCache";
import type {
  Challenge,
  GameMessage,
  GameResult,
  ServerClock,
  ServerSubmission,
  Team,
} from "../types";

const POLL_MS = 5000;

// Resposta de judge-list-submissions.
type MonitorGameResponse = {
  game?: { status?: string; durationSeconds?: number | null };
  result?: GameResult | null;
  messages?: GameMessage[];
  teams?: {
    key: string;
    name: string;
    clock: ServerClock;
    challenges: Challenge[];
  }[];
  submissions?: ServerSubmission[];
};

type MonitorServerState = {
  status: string;
  durationSeconds: number | null;
  result: GameResult | null;
  messages: GameMessage[];
  teams: NonNullable<MonitorGameResponse["teams"]>;
  receivedAt: number;
};

// Dades del panell del monitor d'una partida. Es tornen a demanar cada
// 5 segons mentre el panell és obert.
export function useMonitorGame(gameId: string) {
  const [server, setServer] = useState<MonitorServerState | null>(null);
  const [submissions, setSubmissions] = useState<ServerSubmission[]>([]);
  const [now, setNow] = useState(Date.now());
  // Enllaços a les fotos ja rebuts (vegeu lib/photoUrlCache.ts)
  const photoUrls = useRef<PhotoUrlCache>(new Map());

  async function load() {
    const { data } = await callFunction<MonitorGameResponse>(
      "judge-list-submissions",
      { gameId },
      "No s'han pogut carregar els enviaments."
    );

    if (!data) return;

    setSubmissions(keepPhotoUrls(photoUrls.current, data.submissions ?? []));
    setServer({
      status: data.game?.status ?? "setup",
      durationSeconds: data.game?.durationSeconds ?? null,
      result: data.result ?? null,
      messages: data.messages ?? [],
      teams: data.teams ?? [],
      receivedAt: Date.now(),
    });
    setNow(Date.now());
  }

  // Consulta cada 5 segons
  useEffect(() => {
    load();
    const interval = window.setInterval(load, POLL_MS);

    return () => window.clearInterval(interval);
  }, [gameId]);

  const status = server?.status ?? "setup";
  const running = status === "active";
  const started = status !== "setup";

  // Compte enrere local entre les consultes
  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  const teams: Team[] = (server?.teams ?? []).map((item) => {
    const sinceReceived =
      running && !item.clock.finished
        ? Math.max(0, now - (server?.receivedAt ?? now)) / 1000
        : 0;
    const seconds = Math.max(0, item.clock.remainingSeconds - sinceReceived);

    const finishReason =
      item.clock.finishReason === "completed"
        ? "Llista completada"
        : item.clock.finishReason === "timeout" || (running && seconds <= 0)
          ? "Temps esgotat"
          : status === "finished"
            ? "Partida finalitzada"
            : null;

    return {
      id: item.key,
      name: item.name,
      seconds,
      challenges: item.challenges,
      finished: finishReason !== null,
      finishReason,
    };
  });

  const allFinished =
    status === "finished" ||
    (teams.length > 0 && teams.every((team) => team.finished));

  // Fotos pendents de revisar per equip
  const pendingCounts: Record<string, number> = {};
  for (const submission of submissions) {
    if (submission.status === "pending") {
      pendingCounts[submission.teamKey] =
        (pendingCounts[submission.teamKey] ?? 0) + 1;
    }
  }

  async function startOrPause() {
    await callFunction(
      "judge-set-game-state",
      { gameId, action: running ? "pause" : "start" },
      "No s'ha pogut canviar l'estat de la partida."
    );
    await load();
  }

  async function reset() {
    const confirmed = window.confirm(
      "Segur que vols reiniciar la partida? S'esborraran totes les fotos enviades i els reptes tornaran a estar pendents."
    );

    if (!confirmed) return;

    const { error } = await callFunction(
      "judge-reset-game",
      { gameId },
      "No s'ha pogut reiniciar la partida."
    );

    if (error) {
      alert("No s'ha pogut reiniciar la partida.");
      return;
    }

    await load();
  }

  async function review(
    submissionId: string,
    approved: boolean,
    comment = ""
  ): Promise<string | null> {
    const { error } = await callFunction(
      "review-submission",
      { submissionId, approved, comment },
      "No s'ha pogut desar la revisió."
    );

    if (error) return error;

    await load();
    return null;
  }

  return {
    loaded: server !== null,
    load,
    durationSeconds: server?.durationSeconds ?? null,
    result: server?.result ?? null,
    messages: server?.messages ?? [],
    submissions,
    teams,
    running,
    started,
    allFinished,
    pendingCounts,
    startOrPause,
    reset,
    review,
  };
}
