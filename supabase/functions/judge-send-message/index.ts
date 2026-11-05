import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODY_MAX = 300;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Avís del monitor a tots els equips (teamKey null) o a un sol equip.
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

    let body: { gameId?: unknown; teamKey?: unknown; body?: unknown };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    if (typeof body.gameId !== "string" || !UUID_PATTERN.test(body.gameId)) {
      return response({ error: "Identificador de partida no vàlid." }, 400);
    }

    if (body.teamKey !== null && body.teamKey !== "A" && body.teamKey !== "B") {
      return response({ error: "Destinatari no vàlid." }, 400);
    }

    const text = typeof body.body === "string" ? body.body.trim() : "";

    if (!text || text.length > BODY_MAX) {
      return response({
        error: `El missatge ha de tenir entre 1 i ${BODY_MAX} caràcters.`,
      }, 400);
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
        return response({ error: "No s'ha trobat l'equip." }, 404);
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

    return response({ sent: true });
  } catch (error) {
    console.error("judge-send-message:", error);
    return response({ error: "No s'ha pogut enviar el missatge." }, 500);
  }
});
