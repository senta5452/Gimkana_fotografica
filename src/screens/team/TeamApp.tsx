import { useState } from "react";
import { callFunction } from "../../lib/callFunction";
import { formatTime } from "../../lib/format";
import {
  readTeamToken,
  saveTeamSession,
  useTeamGame,
} from "../../hooks/useTeamGame";
import type { TeamKey } from "../../types";
import TeamLoginScreen from "./TeamLoginScreen";
import TeamNameScreen from "./TeamNameScreen";
import TeamPlayerScreen from "./TeamPlayerScreen";
import TeamMessagesSection from "./TeamMessagesSection";
import SummaryScreen from "./SummaryScreen";
import ResultModal from "./ResultModal";
import MessageAlert from "./MessageAlert";

type TeamAppProps = {
  teamKey: TeamKey;
  onExit: () => void;
};

// Pas on és l'equip: entrar amb codi i PIN, triar el nom (abans que
// comenci la partida), jugar i, quan acaba, veure el resum.
type Step = "login" | "name" | "play" | "summary";

type JoinResponse = { token: string; teamId: string };

export default function TeamApp({ teamKey, onExit }: TeamAppProps) {
  const [step, setStep] = useState<Step>("login");
  const game = useTeamGame(teamKey, step === "name" || step === "play");

  // Entrada
  const [gameCode, setGameCode] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Nom de l'equip
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameBusy, setNameBusy] = useState(false);

  const [selectedChallengeId, setSelectedChallengeId] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    try {
      const { data, error } = await callFunction<JoinResponse>(
        "join-game",
        {
          gameCode: gameCode.trim().toUpperCase(),
          team: teamKey,
          pin: pin.trim(),
        },
        "No s'ha pogut connectar. Torna-ho a provar."
      );

      if (error || !data?.token) {
        setLoginError(error ?? "El servidor no ha retornat un token vàlid.");
        return;
      }

      saveTeamSession(data.token, data.teamId);

      const gameData = await game.load();

      if (!gameData) {
        setLoginError(
          "Has entrat, però no s'han pogut carregar les dades de la partida."
        );
        return;
      }

      // Abans que comenci la partida, l'equip pot triar el seu nom.
      setNameInput(gameData.team?.name ?? `Equip ${teamKey}`);
      setNameError("");
      setStep(gameData.game.status === "setup" ? "name" : "play");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = nameInput.trim().replace(/\s+/g, " ");
    const token = readTeamToken();

    if (!name || !token) return;

    // Si no ha canviat, no cal desar res.
    if (name === game.team.name) {
      setStep("play");
      return;
    }

    setNameBusy(true);
    setNameError("");

    const { error } = await callFunction(
      "set-team-name",
      { token, name },
      "No s'ha pogut desar el nom de l'equip."
    );

    setNameBusy(false);

    if (error) {
      setNameError(error);
      return;
    }

    game.setTeamName(name);
    setStep("play");
  }

  if (step === "login") {
    return (
      <TeamLoginScreen
        teamLabel={teamKey}
        gameCode={gameCode}
        onGameCodeChange={setGameCode}
        pin={pin}
        onPinChange={setPin}
        error={loginError}
        busy={loginBusy}
        onSubmit={handleLogin}
      />
    );
  }

  if (step === "summary") {
    return (
      <SummaryScreen
        team={game.team}
        submissions={game.submissions}
        teamWon={game.result?.winnerKey === teamKey}
        isDraw={Boolean(game.result?.draw)}
        onBack={onExit}
      />
    );
  }

  return (
    <>
      {step === "name" ? (
        <TeamNameScreen
          teamLabel={teamKey}
          name={nameInput}
          onNameChange={setNameInput}
          error={nameError}
          busy={nameBusy}
          onSubmit={handleNameSubmit}
        />
      ) : (
        <section className="team-player-view">
          <TeamPlayerScreen
            team={game.team}
            joinedGameName={game.gameName}
            timeText={game.clock ? formatTime(game.remainingSeconds) : "--:--"}
            running={game.clock?.gameStatus === "active"}
            gameStarted={Boolean(game.clock) && game.clock?.gameStatus !== "setup"}
            finished={game.finished}
            hasPending={game.hasPending}
            submissions={game.submissions}
            uploadStatus={game.uploadStatus}
            selectedChallengeId={selectedChallengeId}
            onSelectChallenge={setSelectedChallengeId}
            onPhotoSelected={(file) => {
              if (!selectedChallengeId) return;

              game.uploadPhoto(selectedChallengeId, file);
              setSelectedChallengeId("");
            }}
          />

          <TeamMessagesSection
            messages={game.messages}
            onSend={game.sendMessage}
          />
        </section>
      )}

      {game.result?.over && (
        <ResultModal
          result={game.result}
          teamKey={teamKey}
          onSummary={() => setStep("summary")}
          onExit={onExit}
        />
      )}

      {/* Avís del monitor: a sobre de tot, fins que l'equip el confirma */}
      {game.messageAlert && (
        <MessageAlert
          message={game.messageAlert}
          onAcknowledge={() => game.acknowledgeMessage(game.messageAlert!)}
        />
      )}
    </>
  );
}
