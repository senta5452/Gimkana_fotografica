export type Challenge = {
  id: number | string;
  title: string;
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