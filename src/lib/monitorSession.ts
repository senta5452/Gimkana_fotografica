import { supabase } from "./supabase";

// Pantalla del monitor on érem, per tornar-hi si es recarrega la pestanya.
// Es guarda a sessionStorage: cada pestanya té la seva.
const MONITOR_VIEW_KEY = "monitorView";

export type MonitorView = "games" | "game" | "library";

export type SavedMonitorView = { view: MonitorView; gameId: string };

export function readSavedMonitorView(): SavedMonitorView | null {
  try {
    const raw = sessionStorage.getItem(MONITOR_VIEW_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw) as { view?: string; gameId?: string };

    if (saved.view === "game" && saved.gameId) {
      return { view: "game", gameId: saved.gameId };
    }

    if (saved.view === "library") return { view: "library", gameId: "" };

    return { view: "games", gameId: "" };
  } catch {
    return null;
  }
}

export function saveMonitorView(view: MonitorView, gameId: string) {
  try {
    sessionStorage.setItem(MONITOR_VIEW_KEY, JSON.stringify({ view, gameId }));
  } catch {
    // Sense sessionStorage, en recarregar es torna a l'inici.
  }
}

// Tanca la sessió del monitor només en aquesta pestanya.
export async function signOutMonitor() {
  try {
    sessionStorage.removeItem(MONITOR_VIEW_KEY);
  } catch {
    // Res a esborrar.
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error("signOut:", error);
  }
}
