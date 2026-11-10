import { useEffect, useRef, useState } from "react";
import { callFunction } from "../lib/callFunction";
import { keepPhotoUrls, type PhotoUrlCache } from "../lib/photoUrlCache";
import { compressPhoto } from "../lib/compressPhoto";
import type {
  Challenge,
  GameMessage,
  GameResult,
  ServerClock,
  Team,
  TeamKey,
  TeamSubmission,
  UploadStatus,
} from "../types";

// Sessió de l'equip a sessionStorage (la crea join-game).
const TOKEN_KEY = "teamToken";
const TEAM_ID_KEY = "teamId";

const POLL_MS = 5000;

type ServerChallenge = {
  id: string;
  title: string;
  description?: string | null;
  approved: boolean;
  bonus_seconds?: number | null;
};

// Resposta de get-team-game (només els camps que fa servir la pantalla).
export type TeamGameResponse = {
  game: { name: string; status: string };
  team?: { name?: string };
  challenges?: ServerChallenge[];
  clock?: ServerClock;
  result?: GameResult;
  messages?: GameMessage[];
  submissions?: TeamSubmission[];
};

export function saveTeamSession(token: string, teamId: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TEAM_ID_KEY, teamId);
}

export function readTeamToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// Fins a quin avís del monitor ha llegit l'equip (data ISO, "" = cap).
// Es guarda al localStorage per no tornar-los a mostrar en recarregar.
function seenMessagesKey() {
  return `teamSeenMessages:${sessionStorage.getItem(TEAM_ID_KEY) ?? ""}`;
}

function readSeenMessagesAt() {
  try {
    return localStorage.getItem(seenMessagesKey()) ?? "";
  } catch {
    return "";
  }
}

// Dades de la partida d'un equip: es carreguen de get-team-game i, mentre
// `polling` és cert, es tornen a demanar cada 5 segons.
export function useTeamGame(teamKey: TeamKey, polling: boolean) {
  const [gameName, setGameName] = useState("");
  const [teamName, setTeamName] = useState(`Equip ${teamKey}`);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<TeamSubmission[]>([]);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [seenMessagesAt, setSeenMessagesAt] = useState<string | null>(null);
  const previousUnseenCount = useRef(0);

  // Rellotge tal com el retorna el servidor i el moment en què s'ha rebut
  // (per comptar enrere entre consultes).
  const [clock, setClock] = useState<
    (ServerClock & { receivedAt: number }) | null
  >(null);
  const [now, setNow] = useState(Date.now());
  // Enllaços a les fotos ja rebuts (vegeu lib/photoUrlCache.ts)
  const photoUrls = useRef<PhotoUrlCache>(new Map());

  // Carrega les dades del servidor. Retorna la resposta, o null si falla.
  async function load(): Promise<TeamGameResponse | null> {
    const token = readTeamToken();
    if (!token) return null;

    const { data } = await callFunction<TeamGameResponse>(
      "get-team-game",
      { token },
      "No s'han pogut carregar les dades de la partida."
    );

    if (!data?.game) return null;

    setGameName(data.game.name);
    setTeamName(data.team?.name ?? `Equip ${teamKey}`);
    setChallenges(
      (data.challenges ?? []).map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        approved: challenge.approved,
        bonusSeconds: challenge.bonus_seconds,
      }))
    );
    setSubmissions(keepPhotoUrls(photoUrls.current, data.submissions ?? []));
    setMessages(data.messages ?? []);
    setResult(data.result ?? null);
    setSeenMessagesAt((current) => current ?? readSeenMessagesAt());

    if (data.clock) {
      setClock({ ...data.clock, receivedAt: Date.now() });
      setNow(Date.now());
    }

    return data;
  }

  // Consulta cada 5 segons
  useEffect(() => {
    if (!polling) return;

    load();
    const interval = window.setInterval(load, POLL_MS);

    return () => window.clearInterval(interval);
  }, [polling]);

  // Compte enrere local entre les consultes
  const clockRunning =
    polling && clock?.gameStatus === "active" && !clock.finished;

  useEffect(() => {
    if (!clockRunning) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [clockRunning]);

  let remainingSeconds = clock?.remainingSeconds ?? 0;

  if (clock && clock.gameStatus === "active" && !clock.finished) {
    const sinceReceived = Math.max(0, now - clock.receivedAt) / 1000;
    remainingSeconds = Math.max(0, clock.remainingSeconds - sinceReceived);
  }

  const finished = Boolean(
    clock &&
      (clock.finished ||
        clock.gameStatus === "finished" ||
        (clock.gameStatus === "active" && remainingSeconds <= 0))
  );

  // L'equip en el format que esperen les pantalles.
  const team: Team = {
    id: teamKey,
    name: teamName,
    seconds: remainingSeconds,
    challenges,
    finished,
    finishReason: null,
  };

  // Avisos del monitor que l'equip encara no ha vist
  const unseenMonitorMessages = messages.filter(
    (message) =>
      message.sender === "monitor" &&
      message.createdAt > (seenMessagesAt ?? "")
  );

  // El mòbil vibra quan arriba un avís nou (on el navegador ho permet).
  useEffect(() => {
    if (unseenMonitorMessages.length > previousUnseenCount.current) {
      navigator.vibrate?.([200, 100, 200]);
    }

    previousUnseenCount.current = unseenMonitorMessages.length;
  }, [unseenMonitorMessages.length]);

  function acknowledgeMessage(message: GameMessage) {
    setSeenMessagesAt(message.createdAt);

    try {
      localStorage.setItem(seenMessagesKey(), message.createdAt);
    } catch {
      // Sense localStorage, l'avís es podria tornar a mostrar en recarregar.
    }
  }

  async function sendMessage(text: string): Promise<string | null> {
    const token = readTeamToken();
    if (!token) return "La sessió de l'equip ha caducat. Torna a entrar.";

    const { error } = await callFunction(
      "send-team-message",
      { token, body: text },
      "No s'ha pogut enviar el missatge."
    );

    if (error) return error;

    await load();
    return null;
  }

  async function uploadPhoto(challengeId: string, file: File) {
    const token = readTeamToken();

    if (!token) {
      setUploadStatus({
        kind: "error",
        text: "La sessió de l'equip ha caducat. Torna a entrar.",
      });
      return;
    }

    setUploadStatus({ kind: "sending", text: "Enviant la fotografia..." });

    // Foto més lleugera: puja més ràpid amb dades mòbils.
    const formData = new FormData();
    formData.append("token", token);
    formData.append("challengeId", challengeId);
    formData.append("photo", await compressPhoto(file));

    const { error } = await callFunction(
      "submit-photo",
      formData,
      "No s'ha pogut enviar la fotografia. Torna-ho a provar."
    );

    if (error) {
      setUploadStatus({ kind: "error", text: error });
      return;
    }

    setUploadStatus({
      kind: "ok",
      text: "Fotografia enviada! Espera que el monitor la revisi.",
    });

    // Així la foto pendent es veu de seguida, sense esperar 5 s.
    await load();
  }

  return {
    load,
    gameName,
    team,
    clock,
    remainingSeconds,
    finished,
    submissions,
    messages,
    result,
    uploadStatus,
    messageAlert: unseenMonitorMessages[0] ?? null,
    hasPending: submissions.some((item) => item.status === "pending"),
    setTeamName,
    acknowledgeMessage,
    sendMessage,
    uploadPhoto,
  };
}
