const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NAME_MAX = 30;

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
    let body: { token?: unknown; name?: unknown };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    const { token } = body;

    if (typeof token !== "string" || token.length < 20) {
      return response({ error: "Sessió no vàlida." }, 401);
    }

    // Espais repetits fora i com a màxim 30 caràcters
    const name =
      typeof body.name === "string"
        ? body.name.trim().replace(/\s+/g, " ")
        : "";

    if (!name || name.length > NAME_MAX) {
      return response({
        error: `El nom ha de tenir entre 1 i ${NAME_MAX} caràcters.`,
      }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !secretKeysRaw) {
      throw new Error("Falta la configuració de Supabase.");
    }

    const secretKey = JSON.parse(secretKeysRaw).default;

    if (!secretKey) {
      throw new Error("No s'ha trobat la clau de servidor.");
    }

    const tokenBytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", tokenBytes);
    const tokenHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const headers = {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    };

    // 1. Sessió de l'equip
    const sessionResponse = await fetch(
      `${supabaseUrl}/rest/v1/team_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null&select=team_id,expires_at`,
      { headers },
    );

    if (!sessionResponse.ok) {
      throw new Error("No s'ha pogut validar la sessió.");
    }

    const session = (await sessionResponse.json())[0];

    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      return response({ error: "La sessió ha caducat. Torna a entrar." }, 401);
    }

    // 2. Equip i partida: el nom només es pot canviar abans de començar
    const teamResponse = await fetch(
      `${supabaseUrl}/rest/v1/teams?id=eq.${session.team_id}&select=id,game_id`,
      { headers },
    );

    if (!teamResponse.ok) {
      throw new Error("No s'han pogut consultar les dades de l'equip.");
    }

    const team = (await teamResponse.json())[0];

    if (!team) {
      return response({ error: "No s'ha trobat l'equip." }, 404);
    }

    const gameResponse = await fetch(
      `${supabaseUrl}/rest/v1/games?id=eq.${team.game_id}&select=status`,
      { headers },
    );

    if (!gameResponse.ok) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    const game = (await gameResponse.json())[0];

    if (!game) {
      return response({ error: "No s'ha trobat la partida." }, 404);
    }

    if (game.status !== "setup") {
      return response({
        error: "El nom només es pot canviar abans que comenci la partida.",
      }, 409);
    }

    // 3. Desar el nom
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/teams?id=eq.${team.id}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ name }),
      },
    );

    if (!updateResponse.ok) {
      throw new Error("No s'ha pogut desar el nom de l'equip.");
    }

    return response({ name });
  } catch (error) {
    console.error("set-team-name:", error);
    return response({ error: "No s'ha pogut desar el nom de l'equip." }, 500);
  }
});
