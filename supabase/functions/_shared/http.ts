// Peces comunes de totes les Edge Functions: capçaleres CORS, respostes JSON
// i validacions bàsiques de la petició.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Respon la consulta prèvia del navegador (OPTIONS) i rebutja qualsevol
// mètode que no sigui POST. Si retorna null, la petició pot continuar.
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Mètode no permès." }, 405);
  }

  return null;
}

// Llegeix el cos JSON de la petició; null si no és JSON vàlid.
export async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as T) : null;
  } catch {
    return null;
  }
}

export function invalidBodyResponse() {
  return jsonResponse({ error: "El cos de la petició no és vàlid." }, 400);
}
