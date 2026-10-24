import { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, Clock3, Flag, Pause, Play, RotateCcw, ShieldCheck, Trophy, X, } from "lucide-react";
const INITIAL_SECONDS = 20 * 60;
const BONUS_SECONDS = 3 * 60;
const SAMPLE_CHALLENGES = [
    "Una bicicleta roja",
    "Una estatua",
    "Un paso de peatones",
    "Un perro con su dueño",
    "Una fuente",
];
function createTeam(id, name) {
    return {
        id,
        name,
        seconds: INITIAL_SECONDS,
        challenges: SAMPLE_CHALLENGES.map((title, index) => ({
            id: index + 1,
            title,
            approved: false,
        })),
        finished: false,
        finishReason: null,
    };
}
function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
export default function App() {
    const [teams, setTeams] = useState([
        createTeam("A", "Equipo A"),
        createTeam("B", "Equipo B"),
    ]);
    const [submissions, setSubmissions] = useState([]);
    const [running, setRunning] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [now, setNow] = useState(Date.now());
    const nextSubmissionId = useRef(1);
    useEffect(() => {
        if (!running)
            return;
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 250);
        return () => window.clearInterval(interval);
    }, [running]);
    useEffect(() => {
        if (!running)
            return;
        const expiredTeamIds = teams
            .filter((team) => !team.finished && team.seconds <= 0)
            .map((team) => team.id);
        if (expiredTeamIds.length === 0)
            return;
        setTeams((currentTeams) => currentTeams.map((team) => expiredTeamIds.includes(team.id)
            ? {
                ...team,
                seconds: 0,
                finished: true,
                finishReason: "Tiempo agotado",
            }
            : team));
    }, [running, teams]);
    const allTeamsFinished = teams.every((team) => team.finished);
    const pendingCount = submissions.filter((submission) => submission.status === "pending").length;
    function startGame() {
        if (allTeamsFinished)
            return;
        setNow(Date.now());
        setGameStarted(true);
        setRunning(true);
    }
    function pauseGame() {
        setRunning(false);
    }
    function resetGame() {
        setTeams([
            createTeam("A", "Equipo A"),
            createTeam("B", "Equipo B"),
        ]);
        setSubmissions([]);
        setRunning(false);
        setGameStarted(false);
        setNow(Date.now());
        nextSubmissionId.current = 1;
    }
    function simulateSubmission(teamId) {
        const team = teams.find((item) => item.id === teamId);
        if (!team || team.finished || !running)
            return;
        const challenge = team.challenges.find((item) => !item.approved);
        if (!challenge)
            return;
        const alreadyPending = submissions.some((submission) => submission.teamId === teamId &&
            submission.challengeId === challenge.id &&
            submission.status === "pending");
        if (alreadyPending)
            return;
        setSubmissions((current) => [
            ...current,
            {
                id: nextSubmissionId.current++,
                teamId,
                challengeId: challenge.id,
                title: challenge.title,
                receivedAt: Date.now(),
                status: "pending",
            },
        ]);
    }
    function reviewSubmission(submissionId, approve) {
        const submission = submissions.find((item) => item.id === submissionId);
        if (!submission || submission.status !== "pending")
            return;
        const team = teams.find((item) => item.id === submission.teamId);
        if (!team)
            return;
        setSubmissions((current) => current.map((item) => item.id === submissionId
            ? {
                ...item,
                status: approve ? "approved" : "rejected",
            }
            : item));
        if (!approve)
            return;
        setTeams((currentTeams) => currentTeams.map((item) => {
            if (item.id !== submission.teamId || item.finished) {
                return item;
            }
            const challenges = item.challenges.map((challenge) => challenge.id === submission.challengeId
                ? { ...challenge, approved: true }
                : challenge);
            const completed = challenges.every((challenge) => challenge.approved);
            return {
                ...item,
                seconds: item.seconds + BONUS_SECONDS,
                challenges,
                finished: completed,
                finishReason: completed ? "Lista completada" : null,
            };
        }));
    }
    function getDisplayedSeconds(team) {
        if (!running || team.finished)
            return team.seconds;
        const elapsed = (now - gameStartReference.current) / 1000;
        return Math.max(0, team.seconds - elapsed);
    }
    // Referencia provisional para la simulación local.
    const gameStartReference = useRef(Date.now());
    useEffect(() => {
        if (running) {
            gameStartReference.current = Date.now();
        }
    }, [running]);
    const finishedTeams = teams.filter((team) => team.finished);
    const winner = finishedTeams.find((team) => team.finishReason === "Lista completada");
    return (<main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Flag size={24}/>
          </div>
          <div>
            <h1>GYMKHANA</h1>
            <p>Panel de control del juez</p>
          </div>
        </div>
        <div className={`status-pill ${running ? "live" : ""}`}>
          <span className="status-dot"/>
          {allTeamsFinished
            ? "FINALIZADA"
            : running
                ? "EN CURSO"
                : gameStarted
                    ? "PAUSADA"
                    : "PREPARADA"}
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">CENTRO DE CONTROL</p>
          <h2>La ciudad es el tablero.</h2>
          <p className="muted">
            Supervisa los equipos y valida cada reto.
          </p>
        </div>
        <div className="rule-chip">
          <Clock3 size={16}/>
          20 min iniciales · +3 min por foto
        </div>
      </section>

      <section className="team-grid">
        {teams.map((team) => {
            const approved = team.challenges.filter((challenge) => challenge.approved).length;
            const progress = (approved / team.challenges.length) * 100;
            return (<article className={`team-card team-${team.id}`} key={team.id}>
              <div className="team-card-top">
                <div className="team-label">
                  <span className="team-marker"/>
                  <span>{team.name}</span>
                </div>
                <span className="team-status">
                  {team.finished
                    ? team.finishReason
                    : running
                        ? "Jugando"
                        : gameStarted
                            ? "En pausa"
                            : "Preparado"}
                </span>
              </div>

              <div className="timer">
                {formatTime(getDisplayedSeconds(team))}
              </div>

              <div className="team-stats">
                <span>
                  <Check size={15}/> {approved}/{team.challenges.length} retos
                </span>
                <span>
                  <Camera size={15}/>{" "}
                  {submissions.filter((submission) => submission.teamId === team.id &&
                    submission.status === "pending").length}{" "}
                  pendientes
                </span>
              </div>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }}/>
              </div>

              <div className="challenge-list">
                {team.challenges.map((challenge) => (<div className="challenge-row" key={challenge.id}>
                    <span className={`challenge-check ${challenge.approved ? "completed" : ""}`}>
                      {challenge.approved ? <Check size={14}/> : challenge.id}
                    </span>
                    <span className={challenge.approved ? "done-text" : ""}>
                      {challenge.title}
                    </span>
                  </div>))}
              </div>

              <button className="secondary-button simulate-button" onClick={() => simulateSubmission(team.id)} disabled={!running ||
                    team.finished ||
                    team.challenges.every((challenge) => challenge.approved)}>
                <Camera size={16}/>
                Simular foto recibida
              </button>
            </article>);
        })}
      </section>

      <section className="control-bar">
        <div className="control-copy">
          <ShieldCheck size={21}/>
          <div>
            <strong>Control de partida</strong>
            <span>Las fotos aprobadas suman 3 minutos.</span>
          </div>
        </div>

        <div className="control-actions">
          <button className="primary-button" onClick={running ? pauseGame : startGame} disabled={allTeamsFinished}>
            {running ? <Pause size={17}/> : <Play size={17}/>}
            {running ? "Pausar" : gameStarted ? "Reanudar" : "Iniciar"}
          </button>
          <button className="secondary-button" onClick={resetGame}>
            <RotateCcw size={16}/>
            Reiniciar
          </button>
        </div>
      </section>

      <section className="submissions-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MODERACIÓN</p>
            <h2>Fotos pendientes</h2>
          </div>
          <span className="count-badge">{pendingCount}</span>
        </div>

        {submissions.filter((item) => item.status === "pending").length ===
            0 ? (<div className="empty-state">
            <div className="empty-icon">
              <Camera size={25}/>
            </div>
            <strong>No hay fotos pendientes</strong>
            <p>
              Cuando un equipo envíe una foto, podrás revisarla aquí.
            </p>
          </div>) : (<div className="submission-list">
            {submissions
                .filter((item) => item.status === "pending")
                .map((submission) => (<article className="submission-card" key={submission.id}>
                  <div className="submission-preview">
                    <Camera size={28}/>
                    <span>Foto de demostración</span>
                  </div>
                  <div className="submission-info">
                    <span className={`mini-team team-${submission.teamId}`}>
                      {submission.teamId === "A" ? "Equipo A" : "Equipo B"}
                    </span>
                    <h3>{submission.title}</h3>
                    <p>Foto recibida · Pendiente de validar</p>
                    <div className="review-actions">
                      <button className="approve-button" onClick={() => reviewSubmission(submission.id, true)}>
                        <Check size={16}/> Aprobar · +3 min
                      </button>
                      <button className="reject-button" onClick={() => reviewSubmission(submission.id, false)}>
                        <X size={16}/> Rechazar
                      </button>
                    </div>
                  </div>
                </article>))}
          </div>)}
      </section>

      {allTeamsFinished && (<section className="result-banner">
          <Trophy size={25}/>
          <div>
            <strong>Partida finalizada</strong>
            <p>
              {winner
                ? `${winner.name} ha completado toda su lista.`
                : "Los equipos han terminado. Revisa los retos aprobados para determinar el resultado."}
            </p>
          </div>
        </section>)}

      <footer className="footer-note">
        <CircleAlert size={15}/>
        Prototipo local: los datos se reinician al recargar la página.
      </footer>
    </main>);
}
