import { useState } from "react";
import { readSavedMonitorView, signOutMonitor } from "./lib/monitorSession";
import HomeScreen from "./screens/common/HomeScreen";
import MonitorApp from "./screens/monitor/MonitorApp";
import TeamApp from "./screens/team/TeamApp";

// Qui fa servir aquesta pestanya: ningú encara (inici), el monitor o un
// dels dos equips.
type Mode = "home" | "monitor" | "teamA" | "teamB";

export default function App() {
  // Si la pestanya es recarrega mentre el monitor hi és, hi tornem.
  const [mode, setMode] = useState<Mode>(() =>
    readSavedMonitorView() ? "monitor" : "home"
  );

  // Tornar a l'inici tanca la sessió: tant el monitor com els equips
  // hauran de tornar a entrar.
  async function goHome() {
    if (mode === "monitor") {
      await signOutMonitor();
    }

    setMode("home");
  }

  return (
    <main className="app-shell">
      {mode === "home" ? (
        <HomeScreen
          onMonitor={() => setMode("monitor")}
          onTeamA={() => setMode("teamA")}
          onTeamB={() => setMode("teamB")}
        />
      ) : (
        <nav className="view-navigation">
          <button className="secondary-button" onClick={goHome}>
            ← Tornar a l'inici
          </button>
        </nav>
      )}

      {mode === "monitor" && <MonitorApp />}

      {(mode === "teamA" || mode === "teamB") && (
        <TeamApp
          key={mode}
          teamKey={mode === "teamA" ? "A" : "B"}
          onExit={goHome}
        />
      )}
    </main>
  );
}
