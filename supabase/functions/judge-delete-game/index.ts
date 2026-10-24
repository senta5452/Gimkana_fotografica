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

// Esborra una partida sencera: enviaments, reptes, sessions i equips, la
// partida i les seves fotos del bucket.
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
      return response({ error: "Cal iniciar sessió com a monitor." }, 401);
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
      return response({ error: "Sessió de monitor no vàlida." }, 401);
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

    // 1. La partida ha de ser d'aquest monitor
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

    // 3. Fotos del bucket (<game_id>/<team_id>/<fitxer>). Si falla, la
    //    partida ja està esborrada: només ho deixem al registre.
    let removedPhotos = 0;

    for (const teamId of teamIds) {
      const folder = `${game.id}/${teamId}`;
      const { data: files, error: listError } = await admin.storage
        .from(BUCKET)
        .list(folder, { limit: 1000 });

      if (listError) {
        console.error("judge-delete-game: no s'han pogut llistar les fotos", listError);
        continue;
      }

      const paths = (files ?? []).map((file) => `${folder}/${file.name}`);

      if (paths.length === 0) continue;

      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove(paths);

      if (removeError) {
        console.error("judge-delete-game: no s'han pogut esborrar les fotos", removeError);
        continue;
      }

      removedPhotos += paths.length;
    }

    return response({ deleted: true, removedPhotos });
  } catch (error) {
    console.error("judge-delete-game:", error);
    return response({ error: "No s'ha pogut esborrar la partida." }, 500);
  }
});
