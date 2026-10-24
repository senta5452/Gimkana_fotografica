import { createClient } from "npm:@supabase/supabase-js@2";
import { getTeamClock } from "../_shared/game-clock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "submission-photos";
const SIGNED_URL_SECONDS = 60 * 60;
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
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return response({ error: "Sessió de jutge no vàlida." }, 401);
    }

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: { gameId?: unknown };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    if (typeof body.gameId !== "string" || !UUID_PATTERN.test(body.gameId)) {
      return response({ error: "Identificador de partida no vàlid." }, 400);
    }

    // 1. La partida ha de ser d'aquest jutge
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status, duration_seconds, clock_started_at, elapsed_seconds")
      .eq("id", body.gameId)
      .eq("judge_id", userData.user.id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return response({ error: "No s'ha trobat la partida." }, 404);
    }

    // 2. Equips de la partida
    const { data: teams, error: teamsError } = await admin
      .from("teams")
      .select(
        "id, team_key, name, finished_at, finish_reason, finish_elapsed_seconds",
      )
      .eq("game_id", game.id)
      .order("team_key");

    if (teamsError) {
      throw new Error("No s'han pogut consultar els equips.");
    }

    const teamIds = (teams ?? []).map((team) => team.id);

    if (teamIds.length === 0) {
      return response({
        game: { status: game.status },
        teams: [],
        submissions: [],
      });
    }

    // 3. Reptes dels equips
    const { data: challenges, error: challengesError } = await admin
      .from("challenges")
      .select("id, team_id, title, approved, position")
      .in("team_id", teamIds)
      .order("position");

    if (challengesError) {
      throw new Error("No s'han pogut consultar els reptes.");
    }

    // 4. Enviaments dels equips
    const { data: submissions, error: submissionsError } = await admin
      .from("submissions")
      .select(
        "id, challenge_id, submitted_by_team, photo_path, status, judge_comment, received_at, reviewed_at",
      )
      .in("submitted_by_team", teamIds)
      .order("received_at");

    if (submissionsError) {
      throw new Error("No s'han pogut consultar els enviaments.");
    }

    // 5. Enllaços temporals per veure les fotos (el bucket és privat)
    const urlByPath = new Map<string, string>();
    const paths = (submissions ?? []).map((item) => item.photo_path);

    if (paths.length > 0) {
      const { data: signed, error: signedError } = await admin.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_SECONDS);

      if (signedError) {
        throw new Error("No s'han pogut generar els enllaços de les fotos.");
      }

      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) {
          urlByPath.set(item.path, item.signedUrl);
        }
      }
    }

    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    const challengeById = new Map(
      (challenges ?? []).map((challenge) => [challenge.id, challenge]),
    );

    const nowMs = Date.now();

    return response({
      game: {
        status: game.status,
        serverNow: new Date(nowMs).toISOString(),
      },
      teams: (teams ?? []).map((team) => {
        const teamChallenges = (challenges ?? []).filter(
          (challenge) => challenge.team_id === team.id,
        );

        const approvedCount = teamChallenges.filter(
          (challenge) => challenge.approved,
        ).length;

        return {
          id: team.id,
          key: team.team_key,
          name: team.name,
          clock: getTeamClock(game, team, approvedCount, nowMs),
          challenges: teamChallenges.map((challenge) => ({
            id: challenge.id,
            title: challenge.title,
            approved: challenge.approved,
          })),
        };
      }),
      submissions: (submissions ?? []).map((item) => ({
        id: item.id,
        teamId: item.submitted_by_team,
        teamKey: teamById.get(item.submitted_by_team)?.team_key ?? "",
        challengeId: item.challenge_id,
        title: challengeById.get(item.challenge_id)?.title ?? "",
        photoUrl: urlByPath.get(item.photo_path) ?? "",
        status: item.status,
        comment: item.judge_comment ?? "",
        receivedAt: item.received_at,
        reviewedAt: item.reviewed_at,
      })),
    });
  } catch (error) {
    console.error("judge-list-submissions:", error);
    return response({ error: "No s'han pogut carregar els enviaments." }, 500);
  }
});