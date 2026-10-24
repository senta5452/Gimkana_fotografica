import { getTeamClock } from "../_shared/game-clock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (typeof token !== "string" || token.length < 20) {
      return new Response(
        JSON.stringify({ error: "Sessió no vàlida." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !secretKeysRaw) {
      throw new Error("Falta la configuració de Supabase.");
    }

    const secretKeys = JSON.parse(secretKeysRaw);
    const secretKey = secretKeys.default;

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

    const sessionResponse = await fetch(
      `${supabaseUrl}/rest/v1/team_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null&select=team_id,expires_at`,
      { headers },
    );

    if (!sessionResponse.ok) {
      throw new Error("No s'ha pogut validar la sessió.");
    }

    const sessions = await sessionResponse.json();
    const session = sessions[0];

    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      return new Response(
        JSON.stringify({ error: "La sessió ha caducat. Torna a entrar." }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const teamResponse = await fetch(
      `${supabaseUrl}/rest/v1/teams?id=eq.${session.team_id}&select=id,game_id,team_key,name,finished_at,finish_reason,finish_elapsed_seconds`,
      { headers },
    );

    if (!teamResponse.ok) {
      throw new Error("No s'han pogut consultar les dades de l'equip.");
    }

    const teams = await teamResponse.json();
    const team = teams[0];

    if (!team) {
      return new Response(
        JSON.stringify({ error: "No s'ha trobat l'equip." }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const gameResponse = await fetch(
      `${supabaseUrl}/rest/v1/games?id=eq.${team.game_id}&select=id,name,game_code,status,duration_seconds,started_at,finished_at,clock_started_at,elapsed_seconds`,
      { headers },
    );

    if (!gameResponse.ok) {
      throw new Error("No s'han pogut consultar les dades de la partida.");
    }

    const games = await gameResponse.json();
    const game = games[0];

    if (!game) {
      return new Response(
        JSON.stringify({ error: "No s'ha trobat la partida." }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

     const challengesResponse = await fetch(
      `${supabaseUrl}/rest/v1/challenges?team_id=eq.${team.id}&select=id,title,description,position,approved&order=position.asc`,
      { headers },
    );

    if (!challengesResponse.ok) {
      throw new Error("No s'han pogut consultar els reptes de l'equip.");
    }

    const challenges = await challengesResponse.json();

    const submissionsResponse = await fetch(
      `${supabaseUrl}/rest/v1/submissions?submitted_by_team=eq.${team.id}&select=id,challenge_id,status,judge_comment,received_at&order=received_at.asc`,
      { headers },
    );

    if (!submissionsResponse.ok) {
      throw new Error("No s'han pogut consultar els enviaments de l'equip.");
    }

    const submissions = await submissionsResponse.json();

    const approvedCount = challenges.filter(
      (challenge: { approved: boolean }) => challenge.approved,
    ).length;

    const clock = getTeamClock(game, team, approvedCount, Date.now());


    return new Response(
      JSON.stringify({
        game,
        team: {
          id: team.id,
          key: team.team_key,
          name: team.name,
        },
        challenges,
        clock: { ...clock, serverNow: new Date().toISOString() },
        submissions: submissions.map(
          (item: {
            id: string;
            challenge_id: string;
            status: string;
            judge_comment: string | null;
            received_at: string;
          }) => ({
            id: item.id,
            challengeId: item.challenge_id,
            status: item.status,
            comment: item.judge_comment ?? "",
            receivedAt: item.received_at,
          }),
        ),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("get-team-game:", error);

    return new Response(
      JSON.stringify({ error: "No s'han pogut carregar les dades de la partida." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});