
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2 || !/^[0-9]{8}$/.test(pin)) return false;

  const fromHex = (hex: string) => {
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
      throw new Error("Hash invàlid");
    }
    return new Uint8Array(
      hex.match(/.{2}/g)!.map((part) => parseInt(part, 16)),
    );
  };

  try {
    const salt = fromHex(parts[0]);
    const expected = fromHex(parts[1]);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pin),
      "PBKDF2",
      false,
      ["deriveBits"],
    );

    const result = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
      key,
      256,
    ));

    if (result.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < result.length; i++) diff |= result[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return respond({ error: "Mètode no permès." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const publishable = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
    ).default;
    const secret = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    ).default;

    if (!url || !publishable || !secret) {
      return respond({ error: "Configuració del servidor incompleta." }, 500);
    }

    let body: { gameCode?: unknown; team?: unknown; pin?: unknown };
    try {
      body = await req.json();
    } catch {
      return respond({ error: "La petició no és vàlida." }, 400);
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
      return respond({ error: "Codi, equip o PIN incorrecte." }, 400);
    }

    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status")
      .eq("game_code", gameCode)
      .maybeSingle();

    if (gameError || !game) {
      return respond({ error: "Codi, equip o PIN incorrecte." }, 401);
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
      return respond({ error: "Codi, equip o PIN incorrecte." }, 401);
    }

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const { error: sessionError } = await admin.from("team_sessions").insert({
      team_id: team.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (sessionError) {
      console.error("No s'ha pogut crear la sessió:", sessionError.code);
      return respond({ error: "No s'ha pogut iniciar la sessió." }, 500);
    }

    return respond({
      token,
      expiresAt,
      teamId: team.id,
      gameId: game.id,
      team: teamKey,
    });
  } catch (error) {
    console.error("Error intern a join-game:", error);
    return respond({ error: "Error intern del servidor." }, 500);
  }
});