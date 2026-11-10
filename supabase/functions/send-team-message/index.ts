// Resposta d'un equip al monitor.
import {
  handlePreflight,
  invalidBodyResponse,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { requireTeamSession } from "../_shared/team-session.ts";

const BODY_MAX = 300;

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const body = await readJsonBody<{ token?: unknown; body?: unknown }>(req);
    if (!body) return invalidBodyResponse();

    const text = typeof body.body === "string" ? body.body.trim() : "";

    const admin = createAdminClient();
    const session = await requireTeamSession(admin, body.token);
    if (session instanceof Response) return session;

    if (!text || text.length > BODY_MAX) {
      return jsonResponse({
        error: `El missatge ha de tenir entre 1 i ${BODY_MAX} caràcters.`,
      }, 400);
    }

    // 1. Equip i partida
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

    // 2. Desar el missatge
    const { error: insertError } = await admin.from("messages").insert({
      game_id: team.game_id,
      team_id: team.id,
      sender: "team",
      body: text,
    });

    if (insertError) {
      throw new Error("No s'ha pogut desar el missatge.");
    }

    return jsonResponse({ sent: true });
  } catch (error) {
    console.error("send-team-message:", error);
    return jsonResponse({ error: "No s'ha pogut enviar el missatge." }, 500);
  }
});
