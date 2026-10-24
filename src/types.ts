export type Challenge = {
  id: number | string;
  title: string;
  approved: boolean;
};

export type Team = {
  id: string;
  name: string;
  seconds: number;
  challenges: Challenge[];
  finished: boolean;
  finishReason: string | null;
};

export type Submission = {
  id: number;
  teamId: string;
  challengeId: number | string;
  title: string;
  photoUrl: string;
  receivedAt: number;
  status: "pending" | "approved" | "rejected";
  comment: string;
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