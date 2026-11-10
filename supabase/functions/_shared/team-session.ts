// Sessions dels equips: join-game crea un token aleatori i en desa només el
// hash SHA-256 a team_sessions. La resta de funcions de l'equip el comproven.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

// Durada d'una sessió d'equip.
export const TEAM_SESSION_HOURS = 8;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toHex(new Uint8Array(digest));
}

// Comprova el token d'un equip. Retorna l'id de l'equip, o bé la resposta
// d'error que cal tornar.
export async function requireTeamSession(
  admin: SupabaseClient,
  token: unknown,
): Promise<{ teamId: string } | Response> {
  if (typeof token !== "string" || token.length < 20) {
    return jsonResponse({ error: "Sessió no vàlida." }, 401);
  }

  const { data: session, error } = await admin
    .from("team_sessions")
    .select("team_id, expires_at")
    .eq("token_hash", await sha256Hex(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("No s'ha pogut validar la sessió.");
  }

  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: "La sessió ha caducat. Torna a entrar." }, 401);
  }

  return { teamId: session.team_id };
}
