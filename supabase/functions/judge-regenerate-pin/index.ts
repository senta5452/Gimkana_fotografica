// Genera un PIN nou per a un equip. Els PIN es guarden com a hash i no es
// poden tornar a llegir; per això, si el monitor no els ha apuntat, se'n
// fa un de nou. L'antic deixa de servir per entrar, però les sessions dels
// equips que ja són dins continuen vàlides.
import {
  handlePreflight,
  invalidBodyResponse,
  isUuid,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { hashPin, randomPin } from "../_shared/pin.ts";
import { requireMonitor } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const auth = await requireMonitor(req);
    if (auth instanceof Response) return auth;
    const { admin, userId } = auth;

    const body = await readJsonBody<{ gameId?: unknown; teamKey?: unknown }>(
      req,
    );
    if (!body) return invalidBodyResponse();

    if (!isUuid(body.gameId)) {
      return jsonResponse({ error: "Identificador de partida no vàlid." }, 400);
    }

    if (body.teamKey !== "A" && body.teamKey !== "B") {
      return jsonResponse({ error: "Equip no vàlid." }, 400);
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

    // 2. PIN nou per a l'equip
    const pin = randomPin();

    const { data: updated, error: updateError } = await admin
      .from("teams")
      .update({ access_code_hash: await hashPin(pin) })
      .eq("game_id", game.id)
      .eq("team_key", body.teamKey)
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error("No s'ha pogut desar el PIN nou.");
    }

    if (!updated) {
      return jsonResponse({ error: "No s'ha trobat l'equip." }, 404);
    }

    return jsonResponse({ teamKey: body.teamKey, pin });
  } catch (error) {
    console.error("judge-regenerate-pin:", error);
    return jsonResponse({ error: "No s'ha pogut generar el PIN nou." }, 500);
  }
});
