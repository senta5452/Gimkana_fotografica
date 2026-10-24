import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "submission-photos";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Mètode no permès." }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response({ error: "Cal iniciar sessió com a jutge." }, 401);
    }

    const accessToken = authorization.slice("Bearer ".length);
    const url = Deno.env.get("SUPABASE_URL");

    const publishableKeys = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
    );
    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    );

    const publishableKey = publishableKeys.default;
    const secretKey = secretKeys.default;

    if (!url || !publishableKey || !secretKey) {
      console.error("Falta la configuració interna de Supabase.");
      return response({ error: "Configuració del servidor incompleta." }, 500);
    }

    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return response({ error: "Sessió de jutge no vàlida." }, 401);
    }

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: { gameId?: unknown };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    if (typeof body.gameId !== "string" || !UUID_PATTERN.test(body.gameId)) {
      return response({ error: "Identificador de partida no vàlid." }, 400);
    }

    // 1. La partida ha de ser d'aquest jutge
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id")
      .eq("id", body.gameId)
      .eq("judge_id", userData.user.id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return response({ error: "No s'ha trobat la partida." }, 404);
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

    // 6. Fotos de la partida al bucket (<game_id>/<team_id>/<fitxer>).
    //    Si falla, la partida ja està reiniciada: només ho deixem al registre.
    let removedPhotos = 0;

    for (const teamId of teamIds) {
      const folder = `${game.id}/${teamId}`;
      const { data: files, error: listError } = await admin.storage
        .from(BUCKET)
        .list(folder, { limit: 1000 });

      if (listError) {
        console.error("judge-reset-game: no s'han pogut llistar les fotos", listError);
        continue;
      }

      const paths = (files ?? []).map((file) => `${folder}/${file.name}`);

      if (paths.length === 0) continue;

      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove(paths);

      if (removeError) {
        console.error("judge-reset-game: no s'han pogut esborrar les fotos", removeError);
        continue;
      }

      removedPhotos += paths.length;
    }

    return response({ game: { status: "setup" }, removedPhotos });
  } catch (error) {
    console.error("judge-reset-game:", error);
    return response({ error: "No s'ha pogut reiniciar la partida." }, 500);
  }
});
