// L'equip tria el seu nom (només abans que comenci la partida).
import {
  handlePreflight,
  invalidBodyResponse,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { requireTeamSession } from "../_shared/team-session.ts";

const NAME_MAX = 30;

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const body = await readJsonBody<{ token?: unknown; name?: unknown }>(req);
    if (!body) return invalidBodyResponse();

    // Espais repetits fora i com a màxim 30 caràcters
    const name = typeof body.name === "string"
      ? body.name.trim().replace(/\s+/g, " ")
      : "";

    const admin = createAdminClient();
    const session = await requireTeamSession(admin, body.token);
    if (session instanceof Response) return session;

    if (!name || name.length > NAME_MAX) {
      return jsonResponse({
        error: `El nom ha de tenir entre 1 i ${NAME_MAX} caràcters.`,
      }, 400);
    }

    // 1. Equip i partida: el nom només es pot canviar abans de començar
    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id, game_id")
      .eq("id", session.teamId)
      .maybeSingle();

    if (teamError) {
      throw new Error("No s'han pogut consultar les dades de l'equip.");
    }

    if (!team) {
      return jsonResponse({ error: "No s'ha trobat l'equip." }, 404);
    }

    const { data: game, error: gameError } = await admin
      .from("games")
      .select("status")
      .eq("id", team.game_id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
    }

    if (game.status !== "setup") {
      return jsonResponse({
        error: "El nom només es pot canviar abans que comenci la partida.",
      }, 409);
    }

    // 2. Desar el nom
    const { error: updateError } = await admin
      .from("teams")
      .update({ name })
      .eq("id", team.id);

    if (updateError) {
      throw new Error("No s'ha pogut desar el nom de l'equip.");
    }

    return jsonResponse({ name });
  } catch (error) {
    console.error("set-team-name:", error);
    return jsonResponse({ error: "No s'ha pogut desar el nom de l'equip." }, 500);
  }
});
