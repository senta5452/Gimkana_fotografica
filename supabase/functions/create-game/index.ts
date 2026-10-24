
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function randomCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
}

function randomPin() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = new DataView(bytes.buffer).getUint32(0);
  return String(value % 100_000_000).padStart(8, "0");
}

async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 310_000,
      hash: "SHA-256",
    },
    key,
    256,
  );

  const toHex = (bytes: Uint8Array) =>
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  return `${toHex(salt)}:${toHex(new Uint8Array(hash))}`;
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
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return response({ error: "Sessió de jutge no vàlida." }, 401);
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let body: { name?: unknown };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "Nova gimcana";

    if (!name || name.length > 100) {
      return response({ error: "El nom ha de tenir entre 1 i 100 caràcters." }, 400);
    }

    let game: { id: string; game_code: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const gameCode = randomCode(8);

      const { data, error } = await admin
        .from("games")
        .insert({
          judge_id: userData.user.id,
          name,
          game_code: gameCode,
          status: "setup",
          duration_seconds: 1200,
        })
        .select("id, game_code")
        .single();

      if (!error && data) {
        game = data;
        break;
      }

      if (error?.code !== "23505") {
        console.error("No s'ha pogut crear la partida:", error?.code);
        return response({ error: "No s'ha pogut crear la partida." }, 500);
      }
    }

    if (!game) {
      return response({ error: "No s'ha pogut generar un codi únic." }, 500);
    }

    const pinA = randomPin();
    const pinB = randomPin();

    const [hashA, hashB] = await Promise.all([
      hashPin(pinA),
      hashPin(pinB),
    ]);

    const { error: teamError } = await admin.from("teams").insert([
      {
        game_id: game.id,
        team_key: "A",
        name: "Equip A",
        access_code_hash: hashA,
      },
      {
        game_id: game.id,
        team_key: "B",
        name: "Equip B",
        access_code_hash: hashB,
      },
    ]);

    if (teamError) {
      console.error("No s'han pogut crear els equips:", teamError.code);

      await admin.from("games").delete().eq("id", game.id);

      return response({ error: "No s'han pogut crear els equips." }, 500);
    }

    return response({
      gameId: game.id,
      gameCode: game.game_code,
      teamA: { pin: pinA },
      teamB: { pin: pinB },
    }, 201);
  } catch (error) {
    console.error("Error intern en crear la partida:", error);
    return response({ error: "Error intern del servidor." }, 500);
  }
});