export type Challenge = {
  id: number | string;
  title: string;
  description?: string | null;
  approved: boolean;
  bonusSeconds?: number | null;
};

export type Team = {
  id: string;
  name: string;
  seconds: number;
  challenges: Challenge[];
  finished: boolean;
  finishReason: string | null;
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

export type ServerSubmission = {
  id: string;
  teamId: string;
  teamKey: string;
  challengeId: string;
  title: string;
  photoUrl: string;
  status: "pending" | "approved" | "rejected";
  comment: string;
  receivedAt: string;
  reviewedAt: string | null;
};