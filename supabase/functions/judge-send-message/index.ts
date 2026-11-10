// Avís del monitor a tots els equips (teamKey null) o a un sol equip.
import {
  handlePreflight,
  invalidBodyResponse,
  isUuid,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { requireMonitor } from "../_shared/supabase.ts";

const BODY_MAX = 300;

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const auth = await requireMonitor(req);
    if (auth instanceof Response) return auth;
    const { admin, userId } = auth;

    const body = await readJsonBody<{
      gameId?: unknown;
      teamKey?: unknown;
      body?: unknown;
    }>(req);
    if (!body) return invalidBodyResponse();

    if (!isUuid(body.gameId)) {
      return jsonResponse({ error: "Identificador de partida no vàlid." }, 400);
    }

    if (body.teamKey !== null && body.teamKey !== "A" && body.teamKey !== "B") {
      return jsonResponse({ error: "Destinatari no vàlid." }, 400);
    }

    const text = typeof body.body === "string" ? body.body.trim() : "";

    if (!text || text.length > BODY_MAX) {
      return jsonResponse({
        error: `El missatge ha de tenir entre 1 i ${BODY_MAX} caràcters.`,
      }, 400);
    }

    // 1. La partida ha de ser d'aquest monitor
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id")
      .eq("id", body.gameId)
      .eq("judge_id", userId)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
    }

    // 2. Equip destinatari (si no és per a tothom)
    let teamId: string | null = null;

    if (body.teamKey) {
      const { data: team, error: teamError } = await admin
        .from("teams")
        .select("id")
        .eq("game_id", game.id)
        .eq("team_key", body.teamKey)
        .maybeSingle();

      if (teamError) {
        throw new Error("No s'ha pogut consultar l'equip.");
      }

      if (!team) {
        return jsonResponse({ error: "No s'ha trobat l'equip." }, 404);
      }

      teamId = team.id;
    }

    // 3. Desar el missatge
    const { error: insertError } = await admin.from("messages").insert({
      game_id: game.id,
      team_id: teamId,
      sender: "monitor",
      body: text,
    });

    if (insertError) {
      throw new Error("No s'ha pogut desar el missatge.");
    }

    return jsonResponse({ sent: true });
  } catch (error) {
    console.error("judge-send-message:", error);
    return jsonResponse({ error: "No s'ha pogut enviar el missatge." }, 500);
  }
});
