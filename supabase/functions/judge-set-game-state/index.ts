import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    let body: { gameId?: unknown; action?: unknown };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    if (typeof body.gameId !== "string" || !UUID_PATTERN.test(body.gameId)) {
      return response({ error: "Identificador de partida no vàlid." }, 400);
    }

    if (body.action !== "start" && body.action !== "pause") {
      return response({ error: "Acció no vàlida." }, 400);
    }

    const action = body.action;

    // 1. La partida ha de ser d'aquest jutge
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status, started_at, clock_started_at, elapsed_seconds")
      .eq("id", body.gameId)
      .eq("judge_id", userData.user.id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return response({ error: "No s'ha trobat la partida." }, 404);
    }

    const now = new Date();
    let changes: Record<string, unknown>;

    if (action === "start") {
      if (game.status === "finished") {
        return response({ error: "La partida ja ha acabat." }, 409);
      }

      if (game.status === "active") {
        return response({ error: "La partida ja està en marxa." }, 409);
      }

      changes = {
        status: "active",
        clock_started_at: now.toISOString(),
        started_at: game.started_at ?? now.toISOString(),
      };
    } else {
      if (game.status !== "active") {
        return response({ error: "La partida no està en marxa." }, 409);
      }

      const runningSeconds = game.clock_started_at
        ? Math.max(
          0,
          (now.getTime() - new Date(game.clock_started_at).getTime()) / 1000,
        )
        : 0;

      changes = {
        status: "paused",
        clock_started_at: null,
        elapsed_seconds: game.elapsed_seconds + runningSeconds,
      };
    }

    // 2. Desar el canvi només si l'estat no ha canviat mentrestant
    const { data: updated, error: updateError } = await admin
      .from("games")
      .update(changes)
      .eq("id", game.id)
      .eq("status", game.status)
      .select("status, started_at, clock_started_at, elapsed_seconds")
      .maybeSingle();

    if (updateError) {
      throw new Error("No s'ha pogut desar l'estat de la partida.");
    }

    if (!updated) {
      return response(
        { error: "L'estat de la partida ha canviat. Torna-ho a provar." },
        409,
      );
    }

    return response({
      game: {
        status: updated.status,
        startedAt: updated.started_at,
        clockStartedAt: updated.clock_started_at,
        elapsedSeconds: updated.elapsed_seconds,
      },
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    console.error("judge-set-game-state:", error);
    return response({ error: "No s'ha pogut canviar l'estat de la partida." }, 500);
  }
});