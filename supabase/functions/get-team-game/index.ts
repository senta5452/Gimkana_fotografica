// Dades que veu un equip: partida, reptes, enviaments, missatges, rellotge
// i resultat. L'equip la consulta cada 5 segons.
import {
  getApprovedBonusSeconds,
  getGameResult,
  getTeamClock,
} from "../_shared/game-clock.ts";
import {
  handlePreflight,
  invalidBodyResponse,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { signPhotoUrls } from "../_shared/photos.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { requireTeamSession } from "../_shared/team-session.ts";

const TEAM_COLUMNS =
  "id, game_id, team_key, name, finished_at, finish_reason, finish_elapsed_seconds";

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const body = await readJsonBody<{ token?: unknown }>(req);
    if (!body) return invalidBodyResponse();

    const admin = createAdminClient();
    const session = await requireTeamSession(admin, body.token);
    if (session instanceof Response) return session;

    // 1. Equip i partida
    const { data: team, error: teamError } = await admin
      .from("teams")
      .select(TEAM_COLUMNS)
      .eq("id", session.teamId)
      .maybeSingle();

    if (teamError) {
      throw new Error("No s'han pogut consultar les dades de l'equip.");
    }

    if (!team) {
      return jsonResponse({ error: "No s'ha trobat l'equip." }, 404);
    }

    const { data: game, error: gameError } = await admin
      .from("games")
      .select(
        "id, name, game_code, status, duration_seconds, started_at, finished_at, clock_started_at, elapsed_seconds",
      )
      .eq("id", team.game_id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'han pogut consultar les dades de la partida.");
    }

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
    }

    // 2. Reptes i enviaments de l'equip
    const { data: challenges, error: challengesError } = await admin
      .from("challenges")
      .select("id, title, description, position, approved, bonus_seconds")
      .eq("team_id", team.id)
      .order("position");

    if (challengesError) {
      throw new Error("No s'han pogut consultar els reptes de l'equip.");
    }

    const { data: submissions, error: submissionsError } = await admin
      .from("submissions")
      .select("id, challenge_id, photo_path, status, judge_comment, received_at")
      .eq("submitted_by_team", team.id)
      .order("received_at");

    if (submissionsError) {
      throw new Error("No s'han pogut consultar els enviaments de l'equip.");
    }

    // 3. Missatges: avisos per a tothom, avisos per a aquest equip i les
    //    seves respostes (els últims 50).
    const { data: messages, error: messagesError } = await admin
      .from("messages")
      .select("id, sender, team_id, body, created_at")
      .eq("game_id", team.game_id)
      .or(`team_id.is.null,team_id.eq.${team.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (messagesError) {
      throw new Error("No s'han pogut consultar els missatges.");
    }

    // 4. Equips de la partida i reptes aprovats de cadascun, per calcular
    //    el resultat (cal conèixer també l'altre equip).
    const { data: gameTeams, error: gameTeamsError } = await admin
      .from("teams")
      .select(TEAM_COLUMNS)
      .eq("game_id", game.id);

    if (gameTeamsError) {
      throw new Error("No s'han pogut consultar els equips de la partida.");
    }

    const { data: approvedRows, error: approvedError } = await admin
      .from("challenges")
      .select("team_id, approved, bonus_seconds")
      .in("team_id", (gameTeams ?? []).map((item) => item.id))
      .eq("approved", true);

    if (approvedError) {
      throw new Error("No s'han pogut consultar els reptes aprovats.");
    }

    const nowMs = Date.now();
    const clock = getTeamClock(
      game,
      team,
      getApprovedBonusSeconds(challenges ?? []),
      nowMs,
    );

    const result = getGameResult(
      game.status,
      (gameTeams ?? []).map((item) => {
        const teamRows = (approvedRows ?? []).filter(
          (row) => row.team_id === item.id,
        );

        return {
          key: item.team_key,
          name: item.name,
          approvedCount: teamRows.length,
          clock: getTeamClock(
            game,
            item,
            getApprovedBonusSeconds(teamRows),
            nowMs,
          ),
        };
      }),
    );

    // 5. Enllaços a les fotos, només quan la partida ha acabat (els fa
    //    servir el resum de l'equip).
    const urlByPath = result.over
      ? await signPhotoUrls(
        admin,
        (submissions ?? []).map((item) => item.photo_path),
      )
      : new Map<string, string>();

    return jsonResponse({
      game,
      team: { id: team.id, key: team.team_key, name: team.name },
      challenges: challenges ?? [],
      clock: { ...clock, serverNow: new Date(nowMs).toISOString() },
      result,
      // Del més antic al més nou
      messages: (messages ?? []).reverse().map((item) => ({
        id: item.id,
        sender: item.sender,
        toAll: item.team_id === null,
        body: item.body,
        createdAt: item.created_at,
      })),
      submissions: (submissions ?? []).map((item) => ({
        id: item.id,
        challengeId: item.challenge_id,
        status: item.status,
        comment: item.judge_comment ?? "",
        receivedAt: item.received_at,
        photoUrl: urlByPath.get(item.photo_path) ?? "",
      })),
    });
  } catch (error) {
    console.error("get-team-game:", error);
    return jsonResponse({
      error: "No s'han pogut carregar les dades de la partida.",
    }, 500);
  }
});
