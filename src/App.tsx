import { useEffect, useState } from "react";
import {
  BookOpen,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Challenge, Team, ServerSubmission } from "./types";
import { formatTime } from "./utils";
import HomeScreen from "./screens/HomeScreen";
import TeamLoginScreen from "./screens/TeamLoginScreen";
import JudgeLoginScreen from "./screens/JudgeLoginScreen";
import SummaryScreen from "./screens/SummaryScreen";
import TeamPlayerScreen from "./screens/TeamPlayerScreen";
import CreateGameSection from "./screens/CreateGameSection";
import JudgeHeader from "./screens/JudgeHeader";
import JudgeTeamGrid from "./screens/JudgeTeamGrid";
import ServerModerationSection from "./screens/ServerModerationSection";
import ChallengeLibraryScreen from "./screens/ChallengeLibraryScreen";


export default function App() {
  
  const [currentView, setCurrentView] = useState<
   "home" | "judge" | "library" | "teamA" | "teamB" | "summaryA" | "summaryB"
  >("home");

  const [entryScreen, setEntryScreen] = useState<
    "home" | "judge-login" | "team-a-login" | "team-b-login"
  >("home");

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [gameCodeInput, setGameCodeInput] = useState("");
  const [teamPinInput, setTeamPinInput] = useState("");
  const [teamLoginError, setTeamLoginError] = useState("");
  const [teamLoginBusy, setTeamLoginBusy] = useState(false);
  const [gameName, setGameName] = useState("Nova gimcana");
  const [creatingGame, setCreatingGame] = useState(false);
  const [gameError, setGameError] = useState("");
  const [createdGame, setCreatedGame] = useState<{
    gameId: string;
    gameCode: string;
    teamA: { pin: string };
    teamB: { pin: string };
  } | null>(null);
  const [joinedGameName, setJoinedGameName] = useState("");

    const [judgeGames, setJudgeGames] = useState<
    {
      id: string;
      name: string;
      game_code: string;
      status: string;
      created_at?: string;
    }[]
  >([]);
  const [selectedGameId, setSelectedGameId] = useState("");

  const [serverSubmissions, setServerSubmissions] = useState<
    ServerSubmission[]
  >([]);

  const [teamSubmissions, setTeamSubmissions] = useState<
    {
      id: string;
      challengeId: string;
      status: "pending" | "approved" | "rejected";
      comment: string;
      receivedAt: string;
      photoUrl?: string;
    }[]
  >([]);

  // Equip que ha entrat (nom i reptes de get-team-game).
  const [teamData, setTeamData] = useState<{
    key: string;
    name: string;
    challenges: Challenge[];
  } | null>(null);

  // Resultat de la partida calculat pel servidor (get-team-game).
  const [teamResult, setTeamResult] = useState<{
    over: boolean;
    draw: boolean;
    byCompletion: boolean;
    winnerKey: string | null;
    winnerName: string | null;
    winnerApproved: number;
  } | null>(null);

  // Rellotge de l'equip tal com el retorna get-team-game, amb el moment
  // en què el navegador l'ha rebut (per comptar enrere entre consultes).
  const [teamClock, setTeamClock] = useState<{
    gameStatus: string;
    finished: boolean;
    finishReason: string | null;
    remainingSeconds: number;
    receivedAt: number;
  } | null>(null);
  const [teamNow, setTeamNow] = useState(Date.now());

  // Estat de la partida i rellotges dels equips per al panell del jutge,
  // tal com els retorna judge-list-submissions.
  const [judgeServer, setJudgeServer] = useState<{
    status: string;
    teams: {
      key: string;
      name: string;
      clock: {
        gameStatus: string;
        finished: boolean;
        finishReason: string | null;
        remainingSeconds: number;
      };
      challenges: Challenge[];
    }[];
    receivedAt: number;
  } | null>(null);
  const [judgeNow, setJudgeNow] = useState(Date.now());

  useEffect(() => {
    if (!session) {
      setJudgeGames([]);
      setSelectedGameId("");
      return;
    }

    async function loadJudgeGames() {
      const { data, error } = await supabase.from("games").select("*");

      if (error) {
        console.error("No s'han pogut carregar les partides:", error);
        return;
      }

      const games = [...(data ?? [])].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      );

      setJudgeGames(games);
      setSelectedGameId((current) => {
        if (
          createdGame &&
          games.some((game) => game.id === createdGame.gameId)
        ) {
          return createdGame.gameId;
        }

        if (games.some((game) => game.id === current)) return current;

        return games[0]?.id ?? "";
      });
    }

    loadJudgeGames();
  }, [session?.user.id, createdGame]);

      async function loadServerSubmissions() {
    if (!selectedGameId) {
      setServerSubmissions([]);
      setJudgeServer(null);
      return;
    }

    const { data, error } = await supabase.functions.invoke(
      "judge-list-submissions",
      { body: { gameId: selectedGameId } }
    );

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("judge-list-submissions:", error.message, detail);
      return;
    }

    setServerSubmissions(data.submissions ?? []);
    setJudgeServer({
      status: data.game?.status ?? "setup",
      teams: data.teams ?? [],
      receivedAt: Date.now(),
    });
    setJudgeNow(Date.now());
  }

  useEffect(() => {
    if (!session) {
      setServerSubmissions([]);
      return;
    }

    loadServerSubmissions();
  }, [session?.user.id, selectedGameId]);

  // Mentre el jutge és al panell, tornem a demanar les fotos cada 5 s.
  useEffect(() => {
    if (currentView !== "judge" || !session || !selectedGameId) return;

    const interval = window.setInterval(loadServerSubmissions, 5000);

    return () => window.clearInterval(interval);
  }, [currentView, session?.user.id, selectedGameId]);

  // Compte enrere local del panell del jutge entre les consultes de 5 s.
  useEffect(() => {
    if (currentView !== "judge" || judgeServer?.status !== "active") return;

    const interval = window.setInterval(() => setJudgeNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [currentView, judgeServer?.status]);

  const judgeStatus = judgeServer?.status ?? "setup";
  const judgeRunning = judgeStatus === "active";
  const judgeStarted = judgeStatus !== "setup";

  const judgeTeams: Team[] = (judgeServer?.teams ?? []).map((item) => {
    const sinceReceived =
      judgeRunning && !item.clock.finished
        ? Math.max(0, judgeNow - (judgeServer?.receivedAt ?? judgeNow)) / 1000
        : 0;
    const seconds = Math.max(0, item.clock.remainingSeconds - sinceReceived);

    const finishReason =
      item.clock.finishReason === "completed"
        ? "Llista completada"
        : item.clock.finishReason === "timeout" || (judgeRunning && seconds <= 0)
          ? "Temps esgotat"
          : judgeStatus === "finished"
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

  const judgeFinished =
    judgeStatus === "finished" ||
    (judgeTeams.length > 0 && judgeTeams.every((team) => team.finished));

  const judgePendingCounts: Record<string, number> = {};
  for (const submission of serverSubmissions) {
    if (submission.status === "pending") {
      judgePendingCounts[submission.teamKey] =
        (judgePendingCounts[submission.teamKey] ?? 0) + 1;
    }
  }

  async function handleJudgeStartPause() {
    await syncGameState(judgeRunning ? "pause" : "start");
    await loadServerSubmissions();
  }

  async function handleJudgeReset() {
    if (!selectedGameId) return;

    const confirmed = window.confirm(
      "Segur que vols reiniciar la partida? S'esborraran totes les fotos enviades i els reptes tornaran a estar pendents."
    );

    if (!confirmed) return;

    const { error } = await supabase.functions.invoke("judge-reset-game", {
      body: { gameId: selectedGameId },
    });

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("judge-reset-game:", error.message, detail);
      alert("No s'ha pogut reiniciar la partida.");
      return;
    }

    await loadServerSubmissions();
  }

    async function handleServerReview(
    submissionId: string,
    approved: boolean,
    comment = ""
  ): Promise<string | null> {
    const { error } = await supabase.functions.invoke("review-submission", {
      body: { submissionId, approved, comment },
    });

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("review-submission:", error.message, detail);

      try {
        return JSON.parse(detail).error ?? "No s'ha pogut desar la revisió.";
      } catch {
        return "No s'ha pogut desar la revisió.";
      }
    }

    await loadServerSubmissions();
    return null;
  }

  async function refreshTeamFromServer() {
    const token = sessionStorage.getItem("teamToken");
    const teamKey = sessionStorage.getItem("teamKey");

    if (!token || !teamKey) return;

    const { data, error } = await supabase.functions.invoke("get-team-game", {
      body: { token },
    });

    if (error || !data?.game) return;


    const loadedChallenges = (data.challenges ?? []).map(
      (challenge: { id: string; title: string; approved: boolean }) => ({
        id: challenge.id,
        title: challenge.title,
        approved: challenge.approved,
      })
    );

    setTeamData({
      key: teamKey,
      name: data.team?.name ?? `Equip ${teamKey}`,
      challenges: loadedChallenges,
    });

    setTeamSubmissions(data.submissions ?? []);
    setTeamResult(data.result ?? null);

    if (data.clock) {
      setTeamClock({ ...data.clock, receivedAt: Date.now() });
      setTeamNow(Date.now());
    }
  }

  useEffect(() => {
    if (currentView !== "teamA" && currentView !== "teamB") return;

    refreshTeamFromServer();

    const interval = window.setInterval(refreshTeamFromServer, 5000);

    return () => window.clearInterval(interval);
  }, [currentView]);

  // Compte enrere local de l'equip entre les consultes de 5 s.
  useEffect(() => {
    if (currentView !== "teamA" && currentView !== "teamB") return;
    if (teamClock?.gameStatus !== "active" || teamClock.finished) return;

    const interval = window.setInterval(() => setTeamNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [currentView, teamClock?.gameStatus, teamClock?.finished]);

  function getTeamRemainingSeconds() {
    if (!teamClock) return 0;

    if (teamClock.gameStatus !== "active" || teamClock.finished) {
      return teamClock.remainingSeconds;
    }

    const sinceReceived = Math.max(0, teamNow - teamClock.receivedAt) / 1000;
    return Math.max(0, teamClock.remainingSeconds - sinceReceived);
  }

  const teamRemainingSeconds = getTeamRemainingSeconds();

  const teamFinished = Boolean(
    teamClock &&
      (teamClock.finished ||
        teamClock.gameStatus === "finished" ||
        (teamClock.gameStatus === "active" && teamRemainingSeconds <= 0))
  );

  // L'equip que ha entrat, en el format que esperen les pantalles.
  const currentTeam: Team | null = teamData
    ? {
        id: teamData.key,
        name: teamData.name,
        seconds: teamRemainingSeconds,
        challenges: teamData.challenges,
        finished: teamFinished,
        finishReason: null,
      }
    : null;

  const [selectedChallengeIds, setSelectedChallengeIds] = useState<
    Record<string, string>
  >({
    A: "",
    B: "",
  });


    async function syncGameState(action: "start" | "pause") {
    if (!selectedGameId) return;

    const { error } = await supabase.functions.invoke(
      "judge-set-game-state",
      { body: { gameId: selectedGameId, action } }
    );

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("judge-set-game-state:", error.message, detail);
    }
  }

  async function uploadPhotoToServer(challengeId: string, file: File) {
    const token = sessionStorage.getItem("teamToken");

    if (!token) {
      console.error("submit-photo: no hi ha token d'equip.");
      return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("challengeId", challengeId);
    formData.append("photo", file);

    const { data, error } = await supabase.functions.invoke("submit-photo", {
      body: formData,
    });

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("submit-photo:", error.message, detail);
      return;
    }

    console.log("Enviament desat a Supabase:", data);
  }

    useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setLoginError("No s'ha pogut comprovar la sessió.");
      }

      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

    async function handleJudgeLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        setLoginError("Correu o contrasenya incorrectes.");
        return;
      }

      if (data.session) {
        setSession(data.session);
      }
    } catch {
      setLoginError("No s'ha pogut connectar amb el servidor.");
    } finally {
      setLoginBusy(false);
    }
  }

    async function handleJudgeLogout() {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setLoginError("No s'ha pogut tancar la sessió.");
        return;
      }

      setSession(null);
      setCurrentView("home");
      setLoginPassword("");
    }

        async function handleTeamLogin(
      event: React.FormEvent<HTMLFormElement>
    ) {
      event.preventDefault();

      setTeamLoginError("");
      setTeamLoginBusy(true);

      const team = entryScreen === "team-a-login" ? "A" : "B";

      try {
        const { data, error } = await supabase.functions.invoke("join-game", {
          body: {
            gameCode: gameCodeInput.trim().toUpperCase(),
            team,
            pin: teamPinInput.trim(),
          },
        });

        if (error || !data?.token) {
          let message = "El servidor no ha retornat un token vàlid.";

          if (error?.context instanceof Response) {
            try {
              message = (await error.context.json()).error ?? message;
            } catch {
              // La resposta no és JSON: mantenim el missatge genèric.
            }
          }

          setTeamLoginError(message);
          return;
        }

        // De moment guardem el token a la sessió del navegador.
        sessionStorage.setItem("teamToken", data.token);
        sessionStorage.setItem("teamGameId", data.gameId);
        sessionStorage.setItem("teamId", data.teamId);
        sessionStorage.setItem("teamKey", data.team);

        const { data: gameData, error: gameError } =
          await supabase.functions.invoke("get-team-game", {
            body: {
              token: data.token,
            },
          });

        if (gameError || !gameData?.game) {
          setTeamLoginError(
            "Has entrat, però no s'han pogut carregar les dades de la partida."
          );
          return;
        }

        setJoinedGameName(gameData.game.name);

        if (gameData.clock) {
          setTeamClock({ ...gameData.clock, receivedAt: Date.now() });
          setTeamNow(Date.now());
        }

        setTeamSubmissions(gameData.submissions ?? []);
        setTeamResult(gameData.result ?? null);

        // Carreguem els reptes que venen de Supabase
        const loadedChallenges = (gameData.challenges ?? []).map(
          (challenge: {
            id: string;
            title: string;
            approved: boolean;
          }) => ({
            id: challenge.id,
            title: challenge.title,
            approved: challenge.approved,
          })
        );

        setTeamData({
          key: team,
          name: gameData.team?.name ?? `Equip ${team}`,
          challenges: loadedChallenges,
        });

        setEntryScreen("home");
        setCurrentView(team === "A" ? "teamA" : "teamB");

      } catch {
        setTeamLoginError(
          "No s'ha pogut connectar. Torna-ho a provar."
        );
      } finally {
        setTeamLoginBusy(false);
      }
    }

    async function handleCreateGame(teamA: string[], teamB: string[]) {
    if (!session?.access_token) {
      setGameError("Has d'iniciar sessió com a monitor.");
      return;
    }

    setCreatingGame(true);
    setGameError("");
    setCreatedGame(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-game",
        {
          body: { name: gameName.trim() || "Nova gimcana", teamA, teamB },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        if (error.context instanceof Response) {
          try {
            const message = (await error.context.json()).error;

            if (message) {
              setGameError(message);
              return;
            }
          } catch {
            // La resposta no és JSON: mostrem el missatge genèric.
          }
        }

        throw error;
      }

      if (!data?.gameCode || !data?.teamA?.pin || !data?.teamB?.pin) {
        throw new Error("La resposta del servidor no és completa.");
      }

      setCreatedGame(data);
    } catch (error) {
      console.error("Error en crear la partida:", error);
      setGameError(
        "No s'ha pogut crear la partida. Comprova la connexió i torna-ho a provar."
      );
    } finally {
      setCreatingGame(false);
    }
  }

  return (
    <main className="app-shell">
      {currentView === "home" && (
        <HomeScreen
          onJudge={() => {
            setEntryScreen("judge-login");
            setCurrentView("judge");
          }}
          onTeamA={() => {
            setEntryScreen("team-a-login");
            setCurrentView("teamA");
          }}
          onTeamB={() => {
            setEntryScreen("team-b-login");
            setCurrentView("teamB");
          }}
        />
      )}
      {currentView !== "home" && (
        <nav className="view-navigation">
          <button
            className="secondary-button"
            onClick={() => {
              setCurrentView("home");
              setEntryScreen("home");
              setLoginError("");
              setGameError("");
            }}
          >
            ← Tornar a l'inici
          </button>
        </nav>
      )}

      {(currentView === "teamA" || currentView === "teamB") &&
        ((currentView === "teamA" && entryScreen === "team-a-login") ||
          (currentView === "teamB" && entryScreen === "team-b-login")) && (
          <TeamLoginScreen
            teamLabel={entryScreen === "team-a-login" ? "A" : "B"}
            gameCode={gameCodeInput}
            onGameCodeChange={setGameCodeInput}
            pin={teamPinInput}
            onPinChange={setTeamPinInput}
            error={teamLoginError}
            busy={teamLoginBusy}
            onSubmit={handleTeamLogin}
          />
        )}
      
      {(currentView === "teamA" || currentView === "teamB") &&
        !(
          (currentView === "teamA" && entryScreen === "team-a-login") ||
          (currentView === "teamB" && entryScreen === "team-b-login")
        ) && (
        <section className="team-player-view">
          {[currentTeam]
            .filter(
              (team): team is Team =>
                team?.id === (currentView === "teamA" ? "A" : "B")
            )
            .map((team) => (
              <TeamPlayerScreen
                key={team.id}
                team={team}
                joinedGameName={joinedGameName}
                timeText={
                  teamClock ? formatTime(teamRemainingSeconds) : "--:--"
                }
                running={teamClock?.gameStatus === "active"}
                gameStarted={
                  Boolean(teamClock) && teamClock?.gameStatus !== "setup"
                }
                finished={teamFinished}
                hasPending={teamSubmissions.some(
                  (submission) => submission.status === "pending"
                )}
                selectedChallengeId={selectedChallengeIds[team.id] || ""}
                onSelectChallenge={(value) =>
                  setSelectedChallengeIds((previous) => ({
                    ...previous,
                    [team.id]: value,
                  }))
                }
                onPhotoSelected={(file) => {
                  const challengeId = selectedChallengeIds[team.id];

                  if (!challengeId) return;

                  uploadPhotoToServer(challengeId, file);

                  setSelectedChallengeIds((previous) => ({
                    ...previous,
                    [team.id]: "",
                  }));
                }}
              />
            ))}
        </section>
      )}
    
      {(currentView === "teamA" || currentView === "teamB") &&
        entryScreen === "home" &&
        teamResult?.over && (
          <div className="result-modal-overlay">
            <section
              className="result-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-modal-title"
            >
              <div className="result-modal-trophy">
                <Trophy size={38} />
              </div>

              <p className="eyebrow">GIMCANA FOTOGRÀFICA</p>

              <h1 id="result-modal-title">
                {teamResult.draw
                  ? "Empat!"
                  : teamResult.winnerKey ===
                      (currentView === "teamA" ? "A" : "B")
                    ? "Heu guanyat!"
                    : "Partida finalitzada"}
              </h1>

              <p className="result-modal-message">
                {teamResult.draw
                  ? "Els dos equips heu acabat amb el mateix nombre de reptes aprovats."
                  : teamResult.byCompletion
                    ? `${teamResult.winnerName} ha completat tota la seva llista i guanya la partida.`
                    : `${teamResult.winnerName} guanya amb ${teamResult.winnerApproved} reptes aprovats.`}
              </p>

              <div className="result-modal-actions">
                <button
                  className="primary-button result-modal-button"
                  onClick={() =>
                    setCurrentView(currentView === "teamA" ? "summaryA" : "summaryB")
                  }
                  style={{ marginTop: 0 }}
                >
                  Resum de la partida
                </button>

                <button
                  className="secondary-button result-modal-button"
                  onClick={() => setCurrentView("home")}
                  style={{ marginTop: 0 }}
                >
                  Tornar a l'inici
                </button>
              </div>
            </section>
          </div>
        )}
      
          {(currentView === "summaryA" || currentView === "summaryB") && (() => {
            const teamId = currentView === "summaryA" ? "A" : "B";
            const team = currentTeam?.id === teamId ? currentTeam : null;

            if (!team) return null;

            return (
              <SummaryScreen
                team={team}
                submissions={teamSubmissions}
                teamWon={teamResult?.winnerKey === teamId}
                isDraw={Boolean(teamResult?.draw)}
                onBack={() => setCurrentView("home")}
              />
            );
          })()}
      {currentView === "judge" && !session && (
        <JudgeLoginScreen
          authLoading={authLoading}
          email={loginEmail}
          onEmailChange={setLoginEmail}
          password={loginPassword}
          onPasswordChange={setLoginPassword}
          error={loginError}
          busy={loginBusy}
          onSubmit={handleJudgeLogin}
        />
      )}

    {currentView === "library" && session && (
      <ChallengeLibraryScreen onBack={() => setCurrentView("judge")} />
    )}

    {currentView === "judge" && session && (
      <>
      <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
        <p className="eyebrow">BIBLIOTECA</p>
        <h2>Reptes de la biblioteca</h2>
        <p className="muted">
          Crea, edita i esborra els reptes que després triaràs per a cada partida.
        </p>
        <button
          className="primary-button"
          onClick={() => setCurrentView("library")}
        >
          <BookOpen size={17} />
          Obrir la biblioteca
        </button>
      </section>

      <CreateGameSection
        gameName={gameName}
        onGameNameChange={setGameName}
        onCreateGame={handleCreateGame}
        onOpenLibrary={() => setCurrentView("library")}
        creating={creatingGame}
        error={gameError}
        createdGame={createdGame}
      />
            <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
        <p className="eyebrow">PARTIDA</p>

        <label htmlFor="judge-game">Partida que supervises</label>
        <select
          id="judge-game"
          value={selectedGameId}
          onChange={(event) => setSelectedGameId(event.target.value)}
          style={{ display: "block", width: "100%" }}
        >
          {judgeGames.length === 0 && (
            <option value="">No tens cap partida</option>
          )}

          {judgeGames.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name} · {game.game_code}
            </option>
          ))}
        </select>
      </section>
      <JudgeHeader
        running={judgeRunning}
        gameStarted={judgeStarted}
        allTeamsFinished={judgeFinished}
        onLogout={handleJudgeLogout}
      />

      <JudgeTeamGrid
        teams={judgeTeams}
        pendingCounts={judgePendingCounts}
        running={judgeRunning}
        gameStarted={judgeStarted}
        getDisplayedSeconds={(team) => team.seconds}
      />

      <ServerModerationSection
        submissions={serverSubmissions}
        onReview={handleServerReview}
      />

      <section className="control-bar">
        <div className="control-copy">
          <ShieldCheck size={21} />
          <div>
            <strong>Control de partida</strong>
            <span>Cada fotografia aprovada suma 3 minuts a l'equip.</span>
          </div>
        </div>

        <div className="control-actions">
          <button
            className="primary-button"
            onClick={handleJudgeStartPause}
            disabled={!judgeServer || judgeFinished}
          >
            {judgeRunning ? <Pause size={17} /> : <Play size={17} />}
            {judgeRunning ? "Pausar" : judgeStarted ? "Reprendre" : "Iniciar"}
          </button>
          <button
            className="secondary-button"
            onClick={handleJudgeReset}
            disabled={!judgeServer}
          >
            <RotateCcw size={16} />
            Reiniciar
          </button>
        </div>
      </section>
      </>
    )}
    </main>
  );
}
