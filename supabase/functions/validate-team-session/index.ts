
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  if (req.method !== "POST") {
    return respond({ error: "Mètode no permès." }, 405);
  }

  try {
    let body: { token?: unknown };

    try {
      body = await req.json();
    } catch {
      return respond({ error: "La petició no és vàlida." }, 400);
    }

    if (
      typeof body.token !== "string" ||
      body.token.length !== 64 ||
      !/^[0-9a-f]{64}$/.test(body.token)
    ) {
      return respond({ error: "Sessió no vàlida o caducada." }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    );
    const secretKey = secretKeys.default;

    if (!url || !secretKey) {
      console.error("Falta la configuració interna de Supabase.");
      return respond({ error: "Configuració del servidor incompleta." }, 500);
    }

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tokenHash = await sha256(body.token);

    const { data: session, error } = await admin
      .from("team_sessions")
      .select("team_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (
      error ||
      !session ||
      session.revoked_at !== null ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      return respond({ error: "Sessió no vàlida o caducada." }, 401);
    }

    return respond({
      valid: true,
      teamId: session.team_id,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    console.error("Error intern validant sessió:", error);
    return respond({ error: "Error intern del servidor." }, 500);
  }
});