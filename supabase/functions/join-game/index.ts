// Entrada d'un equip: comprova codi de partida + PIN i crea una sessió.
import {
  handlePreflight,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { verifyPin } from "../_shared/pin.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  randomToken,
  sha256Hex,
  TEAM_SESSION_HOURS,
} from "../_shared/team-session.ts";

const WRONG_CREDENTIALS = "Codi, equip o PIN incorrecte.";

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const body = await readJsonBody<{
      gameCode?: unknown;
      team?: unknown;
      pin?: unknown;
    }>(req);

    if (!body) {
      return jsonResponse({ error: "La petició no és vàlida." }, 400);
    }

    const gameCode = typeof body.gameCode === "string"
      ? body.gameCode.trim().toUpperCase()
      : "";
    const teamKey = body.team;
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";

    if (
      !/^[A-HJ-NP-Z2-9]{8}$/.test(gameCode) ||
      (teamKey !== "A" && teamKey !== "B") ||
      !/^[0-9]{8}$/.test(pin)
    ) {
      return jsonResponse({ error: WRONG_CREDENTIALS }, 400);
    }

    const admin = createAdminClient();

    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status")
      .eq("game_code", gameCode)
      .maybeSingle();

    if (gameError || !game) {
      return jsonResponse({ error: WRONG_CREDENTIALS }, 401);
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id, access_code_hash")
      .eq("game_id", game.id)
      .eq("team_key", teamKey)
      .maybeSingle();

    if (
      teamError ||
      !team?.access_code_hash ||
      !(await verifyPin(pin, team.access_code_hash))
    ) {
      // Evita revelar si existeix la partida o l'equip.
      return jsonResponse({ error: WRONG_CREDENTIALS }, 401);
    }

    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + TEAM_SESSION_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { error: sessionError } = await admin.from("team_sessions").insert({
      team_id: team.id,
      token_hash: await sha256Hex(token),
      expires_at: expiresAt,
    });

    if (sessionError) {
      console.error("No s'ha pogut crear la sessió:", sessionError.code);
      return jsonResponse({ error: "No s'ha pogut iniciar la sessió." }, 500);
    }

    return jsonResponse({
      token,
      expiresAt,
      teamId: team.id,
      gameId: game.id,
      team: teamKey,
    });
  } catch (error) {
    console.error("join-game:", error);
    return jsonResponse({ error: "Error intern del servidor." }, 500);
  }
});
