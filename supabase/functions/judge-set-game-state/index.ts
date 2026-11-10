// El monitor inicia, pausa o reprèn el rellotge d'una partida.
import {
  handlePreflight,
  invalidBodyResponse,
  isUuid,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { requireMonitor } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const auth = await requireMonitor(req);
    if (auth instanceof Response) return auth;
    const { admin, userId } = auth;

    const body = await readJsonBody<{ gameId?: unknown; action?: unknown }>(req);
    if (!body) return invalidBodyResponse();

    if (!isUuid(body.gameId)) {
      return jsonResponse({ error: "Identificador de partida no vàlid." }, 400);
    }

    if (body.action !== "start" && body.action !== "pause") {
      return jsonResponse({ error: "Acció no vàlida." }, 400);
    }

    const action = body.action;

    // 1. La partida ha de ser d'aquest monitor
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status, started_at, clock_started_at, elapsed_seconds")
      .eq("id", body.gameId)
      .eq("judge_id", userId)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
    }

    const now = new Date();
    let changes: Record<string, unknown>;

    if (action === "start") {
      if (game.status === "finished") {
        return jsonResponse({ error: "La partida ja ha acabat." }, 409);
      }

      if (game.status === "active") {
        return jsonResponse({ error: "La partida ja està en marxa." }, 409);
      }

      changes = {
        status: "active",
        clock_started_at: now.toISOString(),
        started_at: game.started_at ?? now.toISOString(),
      };
    } else {
      if (game.status !== "active") {
        return jsonResponse({ error: "La partida no està en marxa." }, 409);
      }

      const runningSeconds = game.clock_started_at
        ? Math.max(
          0,
          (now.getTime() - new Date(game.clock_started_at).getTime()) / 1000,
        )
        : 0;

      changes = {
        status: "paused",
        clock_started_at: null,
        elapsed_seconds: game.elapsed_seconds + runningSeconds,
      };
    }

    // 2. Desar el canvi només si l'estat no ha canviat mentrestant
    const { data: updated, error: updateError } = await admin
      .from("games")
      .update(changes)
      .eq("id", game.id)
      .eq("status", game.status)
      .select("status, started_at, clock_started_at, elapsed_seconds")
      .maybeSingle();

    if (updateError) {
      throw new Error("No s'ha pogut desar l'estat de la partida.");
    }

    if (!updated) {
      return jsonResponse(
        { error: "L'estat de la partida ha canviat. Torna-ho a provar." },
        409,
      );
    }

    return jsonResponse({
      game: {
        status: updated.status,
        startedAt: updated.started_at,
        clockStartedAt: updated.clock_started_at,
        elapsedSeconds: updated.elapsed_seconds,
      },
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    console.error("judge-set-game-state:", error);
    return jsonResponse({ error: "No s'ha pogut canviar l'estat de la partida." }, 500);
  }
});