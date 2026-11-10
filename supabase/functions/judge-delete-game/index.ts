// Esborra una partida sencera: enviaments, reptes, sessions i equips, la
// partida i les seves fotos del bucket. (Els missatges s'esborren sols en
// cascada amb la partida.)
import {
  handlePreflight,
  invalidBodyResponse,
  isUuid,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { removeGamePhotos } from "../_shared/photos.ts";
import { requireMonitor } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const auth = await requireMonitor(req);
    if (auth instanceof Response) return auth;
    const { admin, userId } = auth;

    const body = await readJsonBody<{ gameId?: unknown }>(req);
    if (!body) return invalidBodyResponse();

    if (!isUuid(body.gameId)) {
      return jsonResponse({ error: "Identificador de partida no vàlid." }, 400);
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

    const { data: teams, error: teamsError } = await admin
      .from("teams")
      .select("id")
      .eq("game_id", game.id);

    if (teamsError) {
      throw new Error("No s'han pogut consultar els equips.");
    }

    const teamIds = (teams ?? []).map((team) => team.id);

    // 2. Files de la base de dades, de les que depenen cap a la partida
    if (teamIds.length > 0) {
      for (const [table, column] of [
        ["submissions", "submitted_by_team"],
        ["challenges", "team_id"],
        ["team_sessions", "team_id"],
        ["teams", "id"],
      ]) {
        const { error } = await admin.from(table).delete().in(column, teamIds);

        if (error) {
          console.error(`judge-delete-game: ${table}`, error);
          throw new Error(`No s'ha pogut esborrar ${table}.`);
        }
      }
    }

    const { error: deleteGameError } = await admin
      .from("games")
      .delete()
      .eq("id", game.id);

    if (deleteGameError) {
      throw new Error("No s'ha pogut esborrar la partida.");
    }

    // 3. Fotos del bucket. Si falla, la partida ja està esborrada: només
    //    ho deixem al registre.
    const removedPhotos = await removeGamePhotos(
      admin,
      game.id,
      teamIds,
      "judge-delete-game",
    );

    return jsonResponse({ deleted: true, removedPhotos });
  } catch (error) {
    console.error("judge-delete-game:", error);
    return jsonResponse({ error: "No s'ha pogut esborrar la partida." }, 500);
  }
});
