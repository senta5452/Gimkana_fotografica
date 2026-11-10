import {
  handlePreflight,
  invalidBodyResponse,
  isUuid,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { requireMonitor } from "../_shared/supabase.ts";
import { signPhotoUrls } from "../_shared/photos.ts";
import {
  getApprovedBonusSeconds,
  getGameResult,
  getTeamClock,
} from "../_shared/game-clock.ts";

// Tot el que veu el panell del monitor d'una partida: estat, equips amb el
// seu rellotge i reptes, enviaments amb enllaç a la foto, missatges i
// resultat. El panell la consulta cada 5 segons.
Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    const auth = await requireMonitor(req);
    if (auth instanceof Response) return auth;
    const { admin, userId } = auth;

    const body = await readJsonBody<{ gameId?: unknown }>(req);
    if (!body) return invalidBodyResponse();

    if (!isUuid(body.gameId)) {
      return jsonResponse({ error: "Identificador de partida no vàlid." }, 400);
    }

    // 1. La partida ha de ser d'aquest monitor
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, status, duration_seconds, clock_started_at, elapsed_seconds")
      .eq("id", body.gameId)
      .eq("judge_id", userId)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
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
      return jsonResponse({
        game: { status: game.status },
        teams: [],
        submissions: [],
      });
    }

    // 3. Reptes dels equips
    const { data: challenges, error: challengesError } = await admin
      .from("challenges")
      .select(
        "id, team_id, title, description, approved, position, bonus_seconds",
      )
      .in("team_id", teamIds)
      .order("position");

    if (challengesError) {
      throw new Error("No s'han pogut consultar els reptes.");
    }

    // 3b. Missatges de la partida (els últims 100)
    const { data: messageRows, error: messagesError } = await admin
      .from("messages")
      .select("id, sender, team_id, body, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (messagesError) {
      throw new Error("No s'han pogut consultar els missatges.");
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
    const urlByPath = await signPhotoUrls(
      admin,
      (submissions ?? []).map((item) => item.photo_path),
    );

    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    const challengeById = new Map(
      (challenges ?? []).map((challenge) => [challenge.id, challenge]),
    );

    const nowMs = Date.now();

    // Resultat de la partida (el mateix càlcul que veuen els equips)
    const result = getGameResult(
      game.status,
      (teams ?? []).map((team) => {
        const teamChallenges = (challenges ?? []).filter(
          (challenge) => challenge.team_id === team.id,
        );

        return {
          key: team.team_key,
          name: team.name,
          approvedCount: teamChallenges.filter((item) => item.approved).length,
          clock: getTeamClock(
            game,
            team,
            getApprovedBonusSeconds(teamChallenges),
            nowMs,
          ),
        };
      }),
    );

    return jsonResponse({
      result,
      // Del més antic al més nou; teamKey buit = avís per a tots els equips
      messages: (messageRows ?? []).reverse().map((item) => ({
        id: item.id,
        sender: item.sender,
        teamKey: item.team_id
          ? teamById.get(item.team_id)?.team_key ?? ""
          : "",
        body: item.body,
        createdAt: item.created_at,
      })),
      game: {
        status: game.status,
        durationSeconds: game.duration_seconds,
        serverNow: new Date(nowMs).toISOString(),
      },
      teams: (teams ?? []).map((team) => {
        const teamChallenges = (challenges ?? []).filter(
          (challenge) => challenge.team_id === team.id,
        );

        return {
          id: team.id,
          key: team.team_key,
          name: team.name,
          clock: getTeamClock(
            game,
            team,
            getApprovedBonusSeconds(teamChallenges),
            nowMs,
          ),
          challenges: teamChallenges.map((challenge) => ({
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            approved: challenge.approved,
            bonusSeconds: challenge.bonus_seconds,
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
    return jsonResponse({ error: "No s'han pogut carregar els enviaments." }, 500);
  }
});