import { getTeamClock } from "../_shared/game-clock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "submission-photos";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const form = await req.formData();
    const token = form.get("token");
    const challengeId = form.get("challengeId");
    const photo = form.get("photo");

    if (typeof token !== "string" || token.length < 20) {
      return jsonResponse({ error: "Sessió no vàlida." }, 401);
    }

    if (typeof challengeId !== "string" || !UUID_PATTERN.test(challengeId)) {
      return jsonResponse({ error: "Repte no vàlid." }, 400);
    }

    if (!(photo instanceof File)) {
      return jsonResponse({ error: "Falta la fotografia." }, 400);
    }

    const extension = ALLOWED_TYPES[photo.type];

    if (!extension) {
      return jsonResponse(
        { error: "La fotografia ha de ser JPG, PNG o WebP." },
        400,
      );
    }

    if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
      return jsonResponse(
        { error: "La fotografia és buida o pesa més de 10 MB." },
        400,
      );
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

    // 1. Validar la sessió de l'equip
    const sessionResponse = await fetch(
      `${supabaseUrl}/rest/v1/team_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null&select=team_id,expires_at`,
      { headers },
    );

    if (!sessionResponse.ok) {
      throw new Error("No s'ha pogut validar la sessió.");
    }

    const session = (await sessionResponse.json())[0];

    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      return jsonResponse(
        { error: "La sessió ha caducat. Torna a entrar." },
        401,
      );
    }

    // 2. Recuperar l'equip
    const teamResponse = await fetch(
      `${supabaseUrl}/rest/v1/teams?id=eq.${session.team_id}&select=id,game_id,finished_at,finish_reason,finish_elapsed_seconds`,
      { headers },
    );

    if (!teamResponse.ok) {
      throw new Error("No s'han pogut consultar les dades de l'equip.");
    }

    const team = (await teamResponse.json())[0];

    if (!team) {
      return jsonResponse({ error: "No s'ha trobat l'equip." }, 404);
    }

    // 2b. La partida ha d'estar en marxa i l'equip no pot haver acabat
    const gameResponse = await fetch(
      `${supabaseUrl}/rest/v1/games?id=eq.${team.game_id}&select=status,duration_seconds,clock_started_at,elapsed_seconds`,
      { headers },
    );

    if (!gameResponse.ok) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    const game = (await gameResponse.json())[0];

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
    }

    if (game.status !== "active") {
      return jsonResponse({ error: "La partida no està en marxa." }, 409);
    }

    const approvedResponse = await fetch(
      `${supabaseUrl}/rest/v1/challenges?team_id=eq.${team.id}&approved=eq.true&select=id`,
      { headers },
    );

    if (!approvedResponse.ok) {
      throw new Error("No s'han pogut consultar els reptes aprovats.");
    }

    const approvedCount = (await approvedResponse.json()).length;
    const clock = getTeamClock(game, team, approvedCount, Date.now());

    if (clock.finished) {
      return jsonResponse(
        { error: "El teu equip ja ha acabat la partida." },
        409,
      );
    }

    // 3. Comprovar que el repte és d'aquest equip i no està aprovat
    const challengeResponse = await fetch(
      `${supabaseUrl}/rest/v1/challenges?id=eq.${challengeId}&team_id=eq.${team.id}&select=id,approved`,
      { headers },
    );

    if (!challengeResponse.ok) {
      throw new Error("No s'ha pogut consultar el repte.");
    }

    const challenge = (await challengeResponse.json())[0];

    if (!challenge) {
      return jsonResponse({ error: "No s'ha trobat el repte." }, 404);
    }

    if (challenge.approved) {
      return jsonResponse({ error: "Aquest repte ja està aprovat." }, 409);
    }

    // 4. Només una foto pendent per equip
    const pendingResponse = await fetch(
      `${supabaseUrl}/rest/v1/submissions?submitted_by_team=eq.${team.id}&status=eq.pending&select=id&limit=1`,
      { headers },
    );

    if (!pendingResponse.ok) {
      throw new Error("No s'han pogut consultar els enviaments.");
    }

    if ((await pendingResponse.json()).length > 0) {
      return jsonResponse(
        { error: "Ja tens una fotografia pendent de validació." },
        409,
      );
    }

    // 5. Pujar la foto al bucket privat
    const photoPath = `${team.game_id}/${team.id}/${crypto.randomUUID()}.${extension}`;

    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${photoPath}`,
      {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": photo.type,
        },
        body: await photo.arrayBuffer(),
      },
    );

    if (!uploadResponse.ok) {
      console.error("submit-photo upload:", await uploadResponse.text());
      throw new Error("No s'ha pogut pujar la fotografia.");
    }

    // 6. Crear la fila a submissions
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        challenge_id: challengeId,
        submitted_by_team: team.id,
        photo_path: photoPath,
      }),
    });

    if (!insertResponse.ok) {
      console.error("submit-photo insert:", await insertResponse.text());

      // Si falla l'inserció, esborrem la foto per no deixar fitxers orfes
      await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${photoPath}`, {
        method: "DELETE",
        headers,
      });

      throw new Error("No s'ha pogut desar l'enviament.");
    }

    const submission = (await insertResponse.json())[0];

    return jsonResponse({
      submission: {
        id: submission.id,
        challengeId: submission.challenge_id,
        status: submission.status,
        receivedAt: submission.received_at,
      },
    });
  } catch (error) {
    console.error("submit-photo:", error);

    return jsonResponse({ error: "No s'ha pogut enviar la fotografia." }, 500);
  }
});