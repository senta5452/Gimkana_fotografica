// Torna una partida a l'estat inicial: sense fotos, sense missatges, reptes
// pendents i rellotge a zero. Els equips i els reptes es mantenen.
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

    // 2. Primer, la partida torna a "setup": així ja no s'accepten fotos
    //    mentre es fa la resta del reinici.
    const { error: resetGameError } = await admin
      .from("games")
      .update({
        status: "setup",
        started_at: null,
        finished_at: null,
        clock_started_at: null,
        elapsed_seconds: 0,
      })
      .eq("id", game.id);

    if (resetGameError) {
      throw new Error("No s'ha pogut reiniciar la partida.");
    }

    const { data: teams, error: teamsError } = await admin
      .from("teams")
      .select("id")
      .eq("game_id", game.id);

    if (teamsError) {
      throw new Error("No s'han pogut consultar els equips.");
    }

    const teamIds = (teams ?? []).map((team) => team.id);

    if (teamIds.length > 0) {
      // 3. Enviaments esborrats
      const { error: submissionsError } = await admin
        .from("submissions")
        .delete()
        .in("submitted_by_team", teamIds);

      if (submissionsError) {
        throw new Error("No s'han pogut esborrar els enviaments.");
      }

      // 3b. Missatges esborrats (la partida torna a començar de zero)
      const { error: messagesError } = await admin
        .from("messages")
        .delete()
        .eq("game_id", game.id);

      if (messagesError) {
        throw new Error("No s'han pogut esborrar els missatges.");
      }

      // 4. Reptes sense aprovar
      const { error: challengesError } = await admin
        .from("challenges")
        .update({ approved: false })
        .in("team_id", teamIds);

      if (challengesError) {
        throw new Error("No s'han pogut reiniciar els reptes.");
      }

      // 5. Equips sense final
      const { error: teamsResetError } = await admin
        .from("teams")
        .update({
          finished_at: null,
          finish_reason: null,
          finish_elapsed_seconds: null,
        })
        .in("id", teamIds);

      if (teamsResetError) {
        throw new Error("No s'han pogut reiniciar els equips.");
      }
    }

    // 6. Fotos de la partida al bucket. Si falla, la partida ja està
    //    reiniciada: només ho deixem al registre.
    const removedPhotos = await removeGamePhotos(
      admin,
      game.id,
      teamIds,
      "judge-reset-game",
    );

    return jsonResponse({ game: { status: "setup" }, removedPhotos });
  } catch (error) {
    console.error("judge-reset-game:", error);
    return jsonResponse({ error: "No s'ha pogut reiniciar la partida." }, 500);
  }
});
