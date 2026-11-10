import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  readSavedMonitorView,
  saveMonitorView,
  type MonitorView,
} from "../../lib/monitorSession";
import type { MonitorGame } from "../../types";
import MonitorLoginScreen from "./MonitorLoginScreen";
import MonitorHomeScreen from "./MonitorHomeScreen";
import MonitorGameScreen from "./MonitorGameScreen";
import ChallengeLibraryScreen from "./ChallengeLibraryScreen";

// Part del monitor: inici de sessió i les seves tres pantalles (inici,
// panell d'una partida i biblioteca de reptes).
export default function MonitorApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Inici de sessió
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Si es recarrega la pestanya, tornem a la pantalla on érem.
  const [view, setView] = useState<MonitorView>(
    () => readSavedMonitorView()?.view ?? "games"
  );
  const [selectedGameId, setSelectedGameId] = useState(
    () => readSavedMonitorView()?.gameId ?? ""
  );
  const [games, setGames] = useState<MonitorGame[]>([]);

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

  useEffect(() => {
    saveMonitorView(view, selectedGameId);
  }, [view, selectedGameId]);

  async function loadGames() {
    const { data, error } = await supabase.from("games").select("*");

    if (error) {
      console.error("No s'han pogut carregar les partides:", error);
      return;
    }

    setGames(
      [...(data ?? [])].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      )
    );
  }

  // Es torna a carregar en tornar a l'inici del monitor (estats al dia) i
  // en obrir una partida (per tenir-ne el nom i el codi).
  useEffect(() => {
    if (!session) {
      setGames([]);
      return;
    }

    if (view === "games" || view === "game") {
      loadGames();
    }
  }, [session?.user.id, view]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
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

  function openGame(gameId: string) {
    setSelectedGameId(gameId);
    setView("game");
  }

  function goToGames() {
    setSelectedGameId("");
    setView("games");
  }

  if (!session) {
    return (
      <MonitorLoginScreen
        authLoading={authLoading}
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        error={loginError}
        busy={loginBusy}
        onSubmit={handleLogin}
      />
    );
  }

  if (view === "library") {
    return <ChallengeLibraryScreen onBack={goToGames} />;
  }

  if (view === "game" && selectedGameId) {
    return (
      <MonitorGameScreen
        key={selectedGameId}
        gameId={selectedGameId}
        game={games.find((game) => game.id === selectedGameId)}
        onBack={goToGames}
      />
    );
  }

  return (
    <MonitorHomeScreen
      games={games}
      onOpenGame={openGame}
      onGamesChanged={loadGames}
      onOpenLibrary={() => setView("library")}
    />
  );
}
