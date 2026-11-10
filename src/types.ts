// Tipus de dades compartits per les pantalles de l'equip i del monitor.

export type TeamKey = "A" | "B";

export type Challenge = {
  id: number | string;
  title: string;
  description?: string | null;
  approved: boolean;
  bonusSeconds?: number | null;
};

// Equip tal com el mostren les pantalles (temps restant ja calculat).
export type Team = {
  id: string;
  name: string;
  seconds: number;
  challenges: Challenge[];
  finished: boolean;
  finishReason: string | null;
};

// Rellotge d'un equip calculat pel servidor (getTeamClock).
export type ServerClock = {
  gameStatus: string;
  finished: boolean;
  finishReason: string | null;
  remainingSeconds: number;
};

// Missatge entre el monitor i els equips.
export type GameMessage = {
  id: string;
  sender: "monitor" | "team";
  body: string;
  createdAt: string;
  // Pantalla de l'equip: avís per a tots els equips
  toAll?: boolean;
  // Panell del monitor: equip ("A"/"B"); buit = avís per a tots
  teamKey?: string;
};

// Resultat de la partida calculat pel servidor (getGameResult).
export type GameResult = {
  over: boolean;
  draw: boolean;
  byCompletion: boolean;
  winnerKey: string | null;
  winnerName: string | null;
  winnerApproved: number;
};

export type SubmissionStatus = "pending" | "approved" | "rejected";

// ---- Equip ----

// Foto enviada per l'equip (get-team-game).
export type TeamSubmission = {
  id: string;
  challengeId: string;
  status: SubmissionStatus;
  comment: string;
  receivedAt: string;
  // Només quan la partida ha acabat (per al resum)
  photoUrl?: string;
};

// Missatge de l'últim enviament de foto de l'equip.
export type UploadStatus = {
  kind: "sending" | "ok" | "error";
  text: string;
};

// ---- Monitor ----

// Partida de la llista del monitor (fila de la taula games).
export type MonitorGame = {
  id: string;
  name: string;
  game_code: string;
  status: string;
  duration_seconds?: number;
  created_at?: string;
};

// Partida acabada de crear (create-game).
export type CreatedGame = {
  gameId: string;
  gameCode: string;
  teamA: { pin: string };
  teamB: { pin: string };
};

// Repte de la biblioteca del monitor (taula challenge_library).
export type LibraryChallenge = {
  id: string;
  title: string;
  description: string | null;
  // Temps propi del repte; null = el temps per defecte de la partida.
  bonus_seconds: number | null;
};

// Foto d'un equip al panell de moderació (judge-list-submissions).
export type ServerSubmission = {
  id: string;
  teamId: string;
  teamKey: string;
  challengeId: string;
  title: string;
  photoUrl: string;
  status: SubmissionStatus;
  comment: string;
  receivedAt: string;
  reviewedAt: string | null;
};
