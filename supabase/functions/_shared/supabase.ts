// Clients de Supabase per a les Edge Functions i comprovació del monitor.
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
};

// Supabase posa aquestes variables a totes les funcions automàticament.
function readConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = JSON.parse(
    Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
  ).default as string | undefined;
  const secretKey = JSON.parse(
    Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
  ).default as string | undefined;

  return { url, publishableKey, secretKey };
}

// Client amb la clau secreta: salta la RLS. Només s'ha de fer servir
// després d'haver comprovat qui fa la petició.
export function createAdminClient(): SupabaseClient {
  const { url, secretKey } = readConfig();

  if (!url || !secretKey) {
    throw new Error("Falta la configuració interna de Supabase.");
  }

  return createClient(url, secretKey, CLIENT_OPTIONS);
}

export type MonitorContext = { admin: SupabaseClient; userId: string };

// Comprova la sessió del monitor (capçalera Authorization amb el JWT).
// Retorna el client d'administració i l'id del monitor, o bé la resposta
// d'error que cal tornar.
export async function requireMonitor(
  req: Request,
): Promise<MonitorContext | Response> {
  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Cal iniciar sessió com a monitor." }, 401);
  }

  const { url, publishableKey, secretKey } = readConfig();

  if (!url || !publishableKey || !secretKey) {
    console.error("Falta la configuració interna de Supabase.");
    return jsonResponse({ error: "Configuració del servidor incompleta." }, 500);
  }

  const authClient = createClient(url, publishableKey, CLIENT_OPTIONS);
  const { data, error } = await authClient.auth.getUser(
    authorization.slice("Bearer ".length),
  );

  if (error || !data.user) {
    return jsonResponse({ error: "Sessió de monitor no vàlida." }, 401);
  }

  return {
    admin: createClient(url, secretKey, CLIENT_OPTIONS),
    userId: data.user.id,
  };
}
