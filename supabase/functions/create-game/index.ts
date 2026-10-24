
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHALLENGES_PER_TEAM = 50;

// Minuts sencers dins d'un interval; si no s'envia, el valor per defecte.
function parseMinutes(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

// Llista d'identificadors de reptes de la biblioteca: entre 1 i 50, sense
// repetits. Retorna null si no és vàlida.
function parseChallengeIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  if (value.length < 1 || value.length > MAX_CHALLENGES_PER_TEAM) return null;
  if (!value.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    return null;
  }
  if (new Set(value).size !== value.length) return null;

  return value as string[];
}

// Barreja aleatòria (Fisher-Yates) amb números segurs.
function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const j = random % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
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
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return response({ error: "Sessió de monitor no vàlida." }, 401);
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let body: {
      name?: unknown;
      teamA?: unknown;
      teamB?: unknown;
      durationMinutes?: unknown;
      defaultBonusMinutes?: unknown;
    };

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

    const durationMinutes = parseMinutes(body.durationMinutes, 1, 180, 20);

    if (durationMinutes === null) {
      return response({
        error: "La durada ha de ser un nombre sencer de minuts entre 1 i 180.",
      }, 400);
    }

    const defaultBonusMinutes = parseMinutes(body.defaultBonusMinutes, 0, 60, 3);

    if (defaultBonusMinutes === null) {
      return response({
        error:
          "El temps per defecte dels reptes ha de ser un nombre sencer de minuts entre 0 i 60.",
      }, 400);
    }

    const teamAIds = parseChallengeIds(body.teamA);
    const teamBIds = parseChallengeIds(body.teamB);

    if (!teamAIds || !teamBIds) {
      return response({
        error:
          `Cada equip ha de tenir entre 1 i ${MAX_CHALLENGES_PER_TEAM} reptes.`,
      }, 400);
    }

    // Els reptes han de ser de la biblioteca d'aquest monitor
    const allIds = [...new Set([...teamAIds, ...teamBIds])];

    const { data: libraryRows, error: libraryError } = await admin
      .from("challenge_library")
      .select("id, title, description, bonus_seconds")
      .eq("judge_id", userData.user.id)
      .in("id", allIds);

    if (libraryError) {
      console.error("No s'ha pogut consultar la biblioteca:", libraryError.code);
      return response({ error: "No s'han pogut consultar els reptes." }, 500);
    }

    const libraryById = new Map(
      (libraryRows ?? []).map((row) => [row.id, row]),
    );

    if (libraryById.size !== allIds.length) {
      return response({
        error: "Algun dels reptes triats ja no existeix a la biblioteca.",
      }, 400);
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
          duration_seconds: durationMinutes * 60,
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

    const { data: createdTeams, error: teamError } = await admin.from("teams").insert([
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
    ]).select("id, team_key");

    if (teamError || !createdTeams) {
      console.error("No s'han pogut crear els equips:", teamError?.code);

      await admin.from("games").delete().eq("id", game.id);

      return response({ error: "No s'han pogut crear els equips." }, 500);
    }

    // Còpia dels reptes triats per a cada equip, en ordre barrejat. És una
    // còpia perquè canviar la biblioteca no alteri les partides ja creades.
    const teamIdByKey = new Map(
      createdTeams.map((team) => [team.team_key, team.id]),
    );

    const challengeRows = [
      { key: "A", ids: teamAIds },
      { key: "B", ids: teamBIds },
    ].flatMap(({ key, ids }) =>
      shuffle(ids).map((id, index) => ({
        team_id: teamIdByKey.get(key),
        title: libraryById.get(id)!.title,
        description: libraryById.get(id)!.description,
        // Temps propi del repte o, si no en té, el per defecte de la partida
        bonus_seconds:
          libraryById.get(id)!.bonus_seconds ?? defaultBonusMinutes * 60,
        position: index + 1,
        approved: false,
      }))
    );

    const { error: challengesError } = await admin
      .from("challenges")
      .insert(challengeRows);

    if (challengesError) {
      console.error("No s'han pogut crear els reptes:", challengesError.code);

      // En esborrar la partida, s'esborren també els equips (cascade).
      await admin.from("games").delete().eq("id", game.id);

      return response({ error: "No s'han pogut crear els reptes." }, 500);
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