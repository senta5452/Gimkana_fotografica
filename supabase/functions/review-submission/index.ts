import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getApprovedBonusSeconds,
  getElapsedSeconds,
  getTeamClock,
} from "../_shared/game-clock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_COMMENT_LENGTH = 500;
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
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return response({ error: "Sessió de monitor no vàlida." }, 401);
    }

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: {
      submissionId?: unknown;
      approved?: unknown;
      comment?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return response({ error: "El cos de la petició no és vàlid." }, 400);
    }

    if (
      typeof body.submissionId !== "string" ||
      !UUID_PATTERN.test(body.submissionId)
    ) {
      return response({ error: "Enviament no vàlid." }, 400);
    }

    if (typeof body.approved !== "boolean") {
      return response({ error: "Cal indicar si s'aprova o es rebutja." }, 400);
    }

    const approved = body.approved;
    const comment =
      typeof body.comment === "string" ? body.comment.trim() : "";

    if (!approved && !comment) {
      return response({ error: "Cal indicar el motiu del rebuig." }, 400);
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      return response(
        { error: "El comentari no pot passar de 500 caràcters." },
        400,
      );
    }

    // 1. Enviament
    const { data: submission, error: submissionError } = await admin
      .from("submissions")
      .select("id, challenge_id, submitted_by_team, status")
      .eq("id", body.submissionId)
      .maybeSingle();

    if (submissionError) {
      throw new Error("No s'ha pogut consultar l'enviament.");
    }

    if (!submission) {
      return response({ error: "No s'ha trobat l'enviament." }, 404);
    }

    // 2. L'equip i la partida han de ser d'aquest jutge
    const { data: team, error: teamError } = await admin
      .from("teams")
      .select(
        "id, game_id, finished_at, finish_reason, finish_elapsed_seconds",
      )
      .eq("id", submission.submitted_by_team)
      .maybeSingle();

    if (teamError) {
      throw new Error("No s'ha pogut consultar l'equip.");
    }

    if (!team) {
      return response({ error: "No s'ha trobat l'enviament." }, 404);
    }

    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status, duration_seconds, clock_started_at, elapsed_seconds")
      .eq("id", team.game_id)
      .eq("judge_id", userData.user.id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return response({ error: "No s'ha trobat l'enviament." }, 404);
    }

    if (submission.status !== "pending") {
      return response(
        { error: "Aquest enviament ja ha estat revisat." },
        409,
      );
    }

    // 2b. Reptes de l'equip i regles de final
    const { data: teamChallenges, error: teamChallengesError } = await admin
      .from("challenges")
      .select("id, approved, bonus_seconds")
      .eq("team_id", team.id);

    if (teamChallengesError) {
      throw new Error("No s'han pogut consultar els reptes de l'equip.");
    }

    const nowMs = Date.now();

    if (approved) {
      const thisChallenge = (teamChallenges ?? []).find(
        (item) => item.id === submission.challenge_id,
      );

      if (!thisChallenge) {
        return response({ error: "No s'ha trobat el repte." }, 404);
      }

      if (thisChallenge.approved) {
        return response({ error: "Aquest repte ja està aprovat." }, 409);
      }

      if (game.status === "finished") {
        return response({ error: "La partida ja ha acabat." }, 409);
      }

      const clock = getTeamClock(
        game,
        team,
        getApprovedBonusSeconds(teamChallenges ?? []),
        nowMs,
      );

      if (clock.finished) {
        return response(
          { error: "Aquest equip ja ha acabat la partida." },
          409,
        );
      }
    }

    // 3. Desar la revisió (només si encara és pendent)
    const { data: updated, error: updateError } = await admin
      .from("submissions")
      .update({
        status: approved ? "approved" : "rejected",
        judge_comment: comment || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submission.id)
      .eq("status", "pending")
      .select("id, status, judge_comment, reviewed_at")
      .maybeSingle();

    if (updateError) {
      throw new Error("No s'ha pogut desar la revisió.");
    }

    if (!updated) {
      return response(
        { error: "Aquest enviament ja ha estat revisat." },
        409,
      );
    }

    // 4. Si s'aprova, marcar el repte com a aprovat
    if (approved) {
      const { error: challengeError } = await admin
        .from("challenges")
        .update({ approved: true })
        .eq("id", submission.challenge_id);

      if (challengeError) {
        console.error("review-submission challenge:", challengeError.code);

        // Desfer la revisió perquè no quedi a mitges
        await admin
          .from("submissions")
          .update({
            status: "pending",
            judge_comment: null,
            reviewed_at: null,
          })
          .eq("id", submission.id);

        throw new Error("No s'ha pogut marcar el repte com a aprovat.");
      }

      // Si ja no queden reptes pendents, l'equip acaba i la partida també
      const remainingChallenges = (teamChallenges ?? []).filter(
        (item) => !item.approved && item.id !== submission.challenge_id,
      ).length;

      if (remainingChallenges === 0) {
        const elapsed = getElapsedSeconds(game, nowMs);
        const finishedAt = new Date(nowMs).toISOString();

        const undoApproval = async () => {
          await admin
            .from("challenges")
            .update({ approved: false })
            .eq("id", submission.challenge_id);

          await admin
            .from("submissions")
            .update({
              status: "pending",
              judge_comment: null,
              reviewed_at: null,
            })
            .eq("id", submission.id);
        };

        const { error: finishTeamError } = await admin
          .from("teams")
          .update({
            finished_at: finishedAt,
            finish_reason: "completed",
            finish_elapsed_seconds: elapsed,
          })
          .eq("id", team.id)
          .is("finished_at", null);

        if (finishTeamError) {
          console.error("review-submission team:", finishTeamError.code);
          await undoApproval();
          throw new Error("No s'ha pogut desar el final de l'equip.");
        }

        const { error: finishGameError } = await admin
          .from("games")
          .update({
            status: "finished",
            finished_at: finishedAt,
            elapsed_seconds: elapsed,
            clock_started_at: null,
          })
          .eq("id", game.id)
          .neq("status", "finished");

        if (finishGameError) {
          console.error("review-submission game:", finishGameError.code);

          await admin
            .from("teams")
            .update({
              finished_at: null,
              finish_reason: null,
              finish_elapsed_seconds: null,
            })
            .eq("id", team.id);

          await undoApproval();
          throw new Error("No s'ha pogut desar el final de la partida.");
        }
      }
    }

    return response({
      submission: {
        id: updated.id,
        status: updated.status,
        comment: updated.judge_comment ?? "",
        reviewedAt: updated.reviewed_at,
      },
    });
  } catch (error) {
    console.error("review-submission:", error);
    return response({ error: "No s'ha pogut desar la revisió." }, 500);
  }
});