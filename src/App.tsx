
import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, Pause, Play, RotateCcw, ShieldCheck, Trophy, X,} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Challenge, Team, Submission, ServerSubmission } from "./types";
import {INITIAL_SECONDS, BONUS_SECONDS, GAME_STORAGE_KEY, createTeam, formatTime,} from "./utils";
import HomeScreen from "./screens/HomeScreen";
import TeamLoginScreen from "./screens/TeamLoginScreen";
import JudgeLoginScreen from "./screens/JudgeLoginScreen";
import SummaryScreen from "./screens/SummaryScreen";
import TeamPlayerScreen from "./screens/TeamPlayerScreen";
import CreateGameSection from "./screens/CreateGameSection";
import JudgeHeader from "./screens/JudgeHeader";
import JudgeTeamGrid from "./screens/JudgeTeamGrid";
import ServerModerationSection from "./screens/ServerModerationSection";


export default function App() {
  
  const [currentView, setCurrentView] = useState<
   "home" | "judge" | "teamA" | "teamB" | "summaryA" | "summaryB"
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
    }[]
  >([]);

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
  }

  useEffect(() => {
    if (!session) {
      setServerSubmissions([]);
      return;
    }

    loadServerSubmissions();
  }, [session?.user.id, selectedGameId]);

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

    setTeams((currentTeams) =>
      currentTeams.map((item) =>
        item.id === teamKey ? { ...item, challenges: loadedChallenges } : item
      )
    );

    setTeamSubmissions(data.submissions ?? []);
  }

  useEffect(() => {
    if (currentView !== "teamA" && currentView !== "teamB") return;

    refreshTeamFromServer();

    const interval = window.setInterval(refreshTeamFromServer, 5000);

    return () => window.clearInterval(interval);
  }, [currentView]);

  const [savedState] = useState(() => {
    try {
      const raw = localStorage.getItem(GAME_STORAGE_KEY);

      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        teams: Team[];
        submissions: Submission[];
        running: boolean;
        gameStarted: boolean;
        gameStartReference: number;
      };

      // Si la partida continuava activa, descomptem
      // el temps transcorregut mentre la pàgina era tancada.
      if (parsed.running) {
        const timestamp = Date.now();
        const elapsed =
          Math.max(0, timestamp - parsed.gameStartReference) / 1000;

        return {
          ...parsed,
          teams: parsed.teams.map((team) =>
            team.finished
              ? team
              : {
                  ...team,
                  seconds: Math.max(0, team.seconds - elapsed),
                }
          ),
          gameStartReference: timestamp,
        };
      }

      return parsed;
    } catch {
      return null;
    }
  });

  const [teams, setTeams] = useState<Team[]>(
    () =>
      savedState?.teams ?? [
        createTeam("A", "Equipo A"),
        createTeam("B", "Equipo B"),
      ]
  );

  const [submissions, setSubmissions] = useState<Submission[]>(
    () => savedState?.submissions ?? []
  );

  const [running, setRunning] = useState(
    () => savedState?.running ?? false
  );

  const [gameStarted, setGameStarted] = useState(
    () => savedState?.gameStarted ?? false
  );

  const [now, setNow] = useState(Date.now());

  const [selectedChallengeIds, setSelectedChallengeIds] = useState<
    Record<string, string>
  >({
    A: "",
    B: "",
  });

  const [rejectionComments, setRejectionComments] = useState<
    Record<number, string>
  >({});

  const [rejectionTarget, setRejectionTarget] = useState<number | null>(
    null
  );

  const nextSubmissionId = useRef(1);
  nextSubmissionId.current =
    Math.max(0, ...submissions.map((item) => item.id)) + 1;

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [running]);

  
  useEffect(() => {
    localStorage.setItem(
      GAME_STORAGE_KEY,
      JSON.stringify({
        teams,
        submissions,
        running,
        gameStarted,
        gameStartReference: gameStartReference.current,
      })
    );
  }, [teams, submissions, running, gameStarted, now]);


useEffect(() => {
  if (!running) return;

  const expiredTeamIds = teams
    .filter(
      (team) =>
        !team.finished &&
        getDisplayedSeconds(team) <= 0
    )
    .map((team) => team.id);

  if (expiredTeamIds.length === 0) return;

  setTeams((currentTeams) =>
    currentTeams.map((team) =>
      expiredTeamIds.includes(team.id)
        ? {
            ...team,
            seconds: 0,
            finished: true,
            finishReason: "Tiempo agotado",
          }
        : team
    )
  );
}, [running, teams, now]);

  const allTeamsFinished = teams.every((team) => team.finished);
  const pendingCount = submissions.filter(
    (submission) => submission.status === "pending"
  ).length;

  
  const approvedCount = submissions.filter(
    (submission) => submission.status === "approved"
  ).length;

  const rejectedCount = submissions.filter(
    (submission) => submission.status === "rejected"
  ).length;

    async function syncGameState(action: "start" | "pause") {
    if (!selectedGameId) return;

    const { data, error } = await supabase.functions.invoke(
      "judge-set-game-state",
      { body: { gameId: selectedGameId, action } }
    );

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("judge-set-game-state:", error.message, detail);
      return;
    }

  }

  
  function startGame() {
    if (allTeamsFinished) return;

    syncGameState("start");

    gameStartReference.current = Date.now();
    setNow(Date.now());
    setGameStarted(true);
    setRunning(true);
  }

  function pauseGame() {
    if (!running) return;

    syncGameState("pause");

    const timestamp = Date.now();
    const elapsed =
      (timestamp - gameStartReference.current) / 1000;

    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.finished
          ? team
          : {
              ...team,
              seconds: Math.max(0, team.seconds - elapsed),
            }
      )
    );

    setNow(timestamp);
    setRunning(false);
  }

  function resetGame() {
    const freshTeams = [
      createTeam("A", "Equipo A"),
      createTeam("B", "Equipo B"),
    ];

    setTeams(freshTeams);
    setSubmissions([]);
    setRunning(false);
    setGameStarted(false);
    setNow(Date.now());
    gameStartReference.current = Date.now();
    localStorage.removeItem(GAME_STORAGE_KEY);
    nextSubmissionId.current = 1;
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

function simulateSubmission(
  teamId: string,
  challengeId: number | string,
  file: File
) {
  const team = teams.find((item) => item.id === teamId);

  if (!team || team.finished || !running) return;

  // Cada equip només pot tenir una foto pendent.
  const teamHasPending = submissions.some(
    (submission) =>
      submission.teamId === teamId &&
      submission.status === "pending"
  );

  if (teamHasPending) {
    alert(
      "Aquest equip ja té una fotografia pendent de validació. Espera que el monitor la revisi."
    );
    return;
  }

  const challenge = team.challenges.find(
    (item) => String(item.id) === String(challengeId)
  );

  if (!challenge) {
    alert("Selecciona un repte vàlid.");
    return;
  }

  if (challenge.approved) {
    alert("Aquest repte ja està aprovat. Tria'n un altre.");
    return;
  }

  const photoUrl = URL.createObjectURL(file);

  setSubmissions((current) => [
    ...current,
    {
      id: nextSubmissionId.current++,
      teamId,
      challengeId: challenge.id,
      title: challenge.title,
      photoUrl,
      receivedAt: Date.now(),
      status: "pending",
      comment: "",
    },
  ]);
}


  function reviewSubmission(
    submissionId: number,
    approve: boolean,
    comment = ""
  ) {
    const submission = submissions.find(
      (item) => item.id === submissionId
    );

    if (!submission || submission.status !== "pending") return;

    if (!approve && !comment.trim()) return;

    const team = teams.find(
      (item) => item.id === submission.teamId
    );

    if (!team) return;

    
    if (approve && team.finished) {
      alert(
        "No es pot aprovar la fotografia: aquest equip ja ha acabat la partida."
      );
      return;
    }

    if (approve) {
      const challenge = team.challenges.find(
        (item) => item.id === submission.challengeId
      );

      if (!challenge || challenge.approved) {
        alert(
          "No es pot aprovar aquesta fotografia: el repte ja està aprovat o no existeix."
        );
        return;
      }
    }

    setSubmissions((current) =>
      current.map((item) =>
        item.id === submissionId
          ? {
              ...item,
              status: approve ? "approved" : "rejected",
              comment: approve ? "" : comment.trim(),
            }
          : item
      )
    );

    if (!approve) return;

    setTeams((currentTeams) =>
      currentTeams.map((item) => {
        if (item.id !== submission.teamId || item.finished) {
          return item;
        }

        const challenges = item.challenges.map((challenge) =>
          challenge.id === submission.challengeId
            ? { ...challenge, approved: true }
            : challenge
        );

        const completed = challenges.every(
          (challenge) => challenge.approved
        );

        return {
          ...item,
          seconds: item.seconds + BONUS_SECONDS,
          challenges,
          finished: completed,
          finishReason: completed ? "Lista completada" : null,
        };
      })
    );
  }

  function getDisplayedSeconds(team: Team) {
    if (!running || team.finished) {
      return Math.max(0, team.seconds);
    }

    const elapsed = (now - gameStartReference.current) / 1000;
    return Math.max(0, team.seconds - elapsed);
  }

  // Referencia provisional para la simulación local.
  const gameStartReference = useRef(
  savedState?.gameStartReference ?? Date.now()
);

  useEffect(() => {
    if (running) {
      gameStartReference.current = Date.now();
    }
  }, [running]);

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
      setLoginError("No s'ha pogut connectar amb Supabase.");
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
          setTeamLoginError(
            data?.error ||
              error?.message ||
              "El servidor no ha retornat un token vàlid."
          );
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

        // Actualitzem només l'equip que acaba d'entrar
        setTeams((currentTeams) =>
          currentTeams.map((item) =>
            item.id === team
              ? {
                  ...item,
                  challenges: loadedChallenges,
                }
              : item
          )
        );

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

    async function handleCreateGame() {
    if (!session?.access_token) {
      setGameError("Has d'iniciar sessió com a jutge.");
      return;
    }

    setCreatingGame(true);
    setGameError("");
    setCreatedGame(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-game",
        {
          body: { name: gameName.trim() || "Nova gimcana" },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
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

const finishedTeams = teams.filter((team) => team.finished);

const winner = finishedTeams.find(
  (team) => team.finishReason === "Lista completada"
);

const gameCompletedByWinner = Boolean(winner);

useEffect(() => {
  if (gameCompletedByWinner && running) {
    pauseGame();
  }
}, [gameCompletedByWinner, running]);

const approvedCounts = teams.map((team) => ({
  ...team,
  approvedCount: team.challenges.filter(
    (challenge) => challenge.approved
  ).length,
}));

const scoreWinner =
  approvedCounts.length === 2
    ? approvedCounts[0].approvedCount > approvedCounts[1].approvedCount
      ? approvedCounts[0]
      : approvedCounts[1].approvedCount > approvedCounts[0].approvedCount
        ? approvedCounts[1]
        : null
    : null;

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
          {teams
            .filter((team) =>
              currentView === "teamA" ? team.id === "A" : team.id === "B"
            )
            .map((team) => (
              <TeamPlayerScreen
                key={team.id}
                team={team}
                joinedGameName={joinedGameName}
                timeText={formatTime(getDisplayedSeconds(team))}
                running={running}
                gameStarted={gameStarted}
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

                  // simulateSubmission(team.id, challengeId, file);
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
        (winner || allTeamsFinished) && (
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
                {!winner && !scoreWinner
                  ? "Empat!"
                  : (winner ?? scoreWinner)?.id ===
                      (currentView === "teamA" ? "A" : "B")
                    ? "Heu guanyat!"
                    : "Partida finalitzada"}
              </h1>

              <p className="result-modal-message">
                {winner
                  ? `${winner.name} ha completat tota la seva llista i guanya la partida.`
                  : scoreWinner
                    ? `${scoreWinner.name} guanya amb ${scoreWinner.approvedCount} reptes aprovats.`
                    : "Els dos equips heu acabat amb el mateix nombre de reptes aprovats."}
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
            const team = teams.find((item) => item.id === teamId);

            if (!team) return null;

            return (
              <SummaryScreen
                team={team}
                submissions={submissions}
                teamWon={(winner ?? scoreWinner)?.id === teamId}
                isDraw={!winner && !scoreWinner}
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

    {currentView === "judge" && session && (
      <>
      <CreateGameSection
        gameName={gameName}
        onGameNameChange={setGameName}
        onCreateGame={handleCreateGame}
        creating={creatingGame}
        error={gameError}
        createdGame={createdGame}
      />
            <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
        <p className="eyebrow">PARTIDA ACTIVA</p>

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
        running={running}
        gameStarted={gameStarted}
        allTeamsFinished={allTeamsFinished}
        onLogout={handleJudgeLogout}
      />

      <JudgeTeamGrid
        teams={teams}
        submissions={submissions}
        running={running}
        gameStarted={gameStarted}
        getDisplayedSeconds={getDisplayedSeconds}
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
            <span>Obtindras 3 minuts per cada fotografia correcte.</span>
          </div>
        </div>

        <div className="control-actions">
          <button
            className="primary-button"
            onClick={running ? pauseGame : startGame}
            disabled={allTeamsFinished}
          >
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? "Pausar" : gameStarted ? "Reanudar" : "Iniciar"}
          </button>
          <button className="secondary-button" onClick={resetGame}>
            <RotateCcw size={16} />
            Reiniciar
          </button>
        </div>
      </section>

      <section className="submissions-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MODERACIÓ</p>
            <h2>Fotos pendients</h2>
          </div>
          <span className="count-badge">{pendingCount}</span>
        </div>

        {submissions.filter((item) => item.status === "pending").length ===
        0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Camera size={25} />
            </div>
            <strong>No hi ha fotos pendients</strong>
            <p>
              Quan un equip envíi una foto, podràs revisar-la aquí.
            </p>
          </div>
        ) : (
          <div className="submission-list">
            {submissions
              .filter((item) => item.status === "pending")
              .sort((a, b) => a.receivedAt - b.receivedAt)
              .map((submission) => (
                <article className="submission-card" key={submission.id}>
                  
                  <div className="submission-preview">
                    <img
                      src={submission.photoUrl}
                      alt={`Fotografia del repte: ${submission.title}`}
                      style={{
                        width: "100%",
                        maxHeight: "320px",
                        objectFit: "contain",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                  <div className="submission-info">
                    <span className={`mini-team team-${submission.teamId}`}>
                      {submission.teamId === "A" ? "Equip A" : "Equip B"}
                    </span>
                    <h3>{submission.title}</h3>
                    <p>
                      Rebuda a les{" "}
                      {new Date(submission.receivedAt).toLocaleTimeString("ca-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>

                    <p>Estat: pendent de validació</p>
                    <div className="review-actions">
                      <button
                        className="approve-button"
                        onClick={() =>
                          reviewSubmission(submission.id, true)
                        }
                      >
                        <Check size={16} /> Aprovar · +3 min
                      </button>
                      <button
                        className="reject-button"
                        onClick={() => {
                          setRejectionTarget(submission.id);
                          setRejectionComments((current) => ({
                            ...current,
                            [submission.id]: current[submission.id] ?? "",
                          }));
                        }}
                      >
                        <X size={16} /> Rebutjar
                      </button>
                    </div>
                    
                    {rejectionTarget === submission.id && (
                      <div className="rejection-form">
                        <label htmlFor={`rejection-${submission.id}`}>
                          Motiu del rebuig (obligatori)   
                        </label>

                        <textarea
                          id={`rejection-${submission.id}`}
                          value={rejectionComments[submission.id] ?? ""}
                          onChange={(event) =>
                            setRejectionComments((current) => ({
                              ...current,
                              [submission.id]: event.target.value,
                            }))
                          }
                          placeholder="Explica per què no s'accepta aquesta fotografia..."
                          rows={3}
                          required
                        />

                        <div className="review-actions">
                          <button
                            className="reject-button"
                            disabled={!(rejectionComments[submission.id] ?? "").trim()}
                            onClick={() => {
                              reviewSubmission(
                                submission.id,
                                false,
                                rejectionComments[submission.id] ?? ""
                              );
                              setRejectionTarget(null);
                            }}
                          >
                            Confirmar rebuig
                          </button>

                          <button
                            type="button"
                            className="approve-button"
                            onClick={() => setRejectionTarget(null)}
                          >
                            Cancel·lar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
          </div>
        )}
      </section>

      
      <section className="submissions-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">REGISTRE</p>
            <h2>Historial de revisions</h2>
          </div>
          <span className="count-badge">
            {approvedCount + rejectedCount}
          </span>
        </div>

        <div className="history-summary">
          <span>Aprovades: {approvedCount} | </span>
          <span> Rebutjades: {rejectedCount}</span>
        </div>

        {submissions.filter(
          (submission) =>
            submission.status === "approved" ||
            submission.status === "rejected"
        ).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ShieldCheck size={25} />
            </div>
            <strong>Encara no hi ha revisions</strong>
            <p>
              Les fotografies aprovades i rebutjades apareixeran aquí.
            </p>
          </div>
        ) : (
          <div className="submission-list">
            {submissions
              .filter(
                (submission) =>
                  submission.status === "approved" ||
                  submission.status === "rejected"
              )
              .sort((a, b) => b.receivedAt - a.receivedAt)
              .map((submission) => (
                <article
                  className="submission-card"
                  key={submission.id}
                >
                  <div className="submission-preview">
                    <img
                      src={submission.photoUrl}
                      alt={`Fotografia del repte: ${submission.title}`}
                      style={{
                        width: "100%",
                        maxHeight: "240px",
                        objectFit: "contain",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                  <div className="submission-info">
                    <span
                      className={`mini-team team-${submission.teamId}`}
                    >
                      {submission.teamId === "A"
                        ? "Equip A"
                        : "Equip B"}
                    </span>

                    <h3>{submission.title}</h3>

                    <p>
                      Rebuda:{" "}
                      {new Date(submission.receivedAt).toLocaleString(
                        "ca-ES"
                      )}
                    </p>

                    <p>
                      Resultat:{" "}
                      <strong>
                        {submission.status === "approved"
                          ? "Aprovada"
                          : "Rebutjada"}
                      </strong>
                    </p>

                    {submission.status === "rejected" && (
                      <p>
                        <strong>Motiu:</strong>{" "}
                        {submission.comment || "Sense comentari"}
                      </p>
                    )}
                  </div>
                </article>
              ))}
          </div>
        )}
      </section>

      <footer className="footer-note">
        <CircleAlert size={15} />
        Prototipo local: los datos se reinician al recargar la página.
      </footer>
      </>
    )}
    </main>
  );
}
