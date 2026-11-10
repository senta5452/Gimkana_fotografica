// Un equip envia la foto d'un repte (formulari amb token, challengeId i photo).
import {
  getApprovedBonusSeconds,
  getTeamClock,
} from "../_shared/game-clock.ts";
import { handlePreflight, isUuid, jsonResponse } from "../_shared/http.ts";
import { PHOTO_BUCKET } from "../_shared/photos.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { requireTeamSession } from "../_shared/team-session.ts";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

Deno.serve(async (req) => {
  const early = handlePreflight(req);
  if (early) return early;

  try {
    let form: FormData;

    try {
      form = await req.formData();
    } catch {
      return jsonResponse({ error: "El cos de la petició no és vàlid." }, 400);
    }

    const token = form.get("token");
    const challengeId = form.get("challengeId");
    const photo = form.get("photo");

    if (typeof token !== "string" || token.length < 20) {
      return jsonResponse({ error: "Sessió no vàlida." }, 401);
    }

    if (!isUuid(challengeId)) {
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

    const admin = createAdminClient();

    // 1. Validar la sessió de l'equip
    const session = await requireTeamSession(admin, token);
    if (session instanceof Response) return session;

    // 2. Recuperar l'equip
    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id, game_id, finished_at, finish_reason, finish_elapsed_seconds")
      .eq("id", session.teamId)
      .maybeSingle();

    if (teamError) {
      throw new Error("No s'han pogut consultar les dades de l'equip.");
    }

    if (!team) {
      return jsonResponse({ error: "No s'ha trobat l'equip." }, 404);
    }

    // 2b. La partida ha d'estar en marxa i l'equip no pot haver acabat
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("status, duration_seconds, clock_started_at, elapsed_seconds")
      .eq("id", team.game_id)
      .maybeSingle();

    if (gameError) {
      throw new Error("No s'ha pogut consultar la partida.");
    }

    if (!game) {
      return jsonResponse({ error: "No s'ha trobat la partida." }, 404);
    }

    if (game.status !== "active") {
      return jsonResponse({ error: "La partida no està en marxa." }, 409);
    }

    const { data: approvedRows, error: approvedError } = await admin
      .from("challenges")
      .select("approved, bonus_seconds")
      .eq("team_id", team.id)
      .eq("approved", true);

    if (approvedError) {
      throw new Error("No s'han pogut consultar els reptes aprovats.");
    }

    const clock = getTeamClock(
      game,
      team,
      getApprovedBonusSeconds(approvedRows ?? []),
      Date.now(),
    );

    if (clock.finished) {
      return jsonResponse(
        { error: "El teu equip ja ha acabat la partida." },
        409,
      );
    }

    // 3. Comprovar que el repte és d'aquest equip i no està aprovat
    const { data: challenge, error: challengeError } = await admin
      .from("challenges")
      .select("id, approved")
      .eq("id", challengeId)
      .eq("team_id", team.id)
      .maybeSingle();

    if (challengeError) {
      throw new Error("No s'ha pogut consultar el repte.");
    }

    if (!challenge) {
      return jsonResponse({ error: "No s'ha trobat el repte." }, 404);
    }

    if (challenge.approved) {
      return jsonResponse({ error: "Aquest repte ja està aprovat." }, 409);
    }

    // 4. Només una foto pendent per equip
    const { data: pending, error: pendingError } = await admin
      .from("submissions")
      .select("id")
      .eq("submitted_by_team", team.id)
      .eq("status", "pending")
      .limit(1);

    if (pendingError) {
      throw new Error("No s'han pogut consultar els enviaments.");
    }

    if ((pending ?? []).length > 0) {
      return jsonResponse(
        { error: "Ja tens una fotografia pendent de validació." },
        409,
      );
    }

    // 5. Pujar la foto al bucket privat
    const photoPath =
      `${team.game_id}/${team.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, await photo.arrayBuffer(), {
        contentType: photo.type,
      });

    if (uploadError) {
      console.error("submit-photo upload:", uploadError);
      throw new Error("No s'ha pogut pujar la fotografia.");
    }

    // 6. Crear la fila a submissions
    const { data: submission, error: insertError } = await admin
      .from("submissions")
      .insert({
        challenge_id: challengeId,
        submitted_by_team: team.id,
        photo_path: photoPath,
      })
      .select("id, challenge_id, status, received_at")
      .single();

    if (insertError || !submission) {
      console.error("submit-photo insert:", insertError);

      // Si falla l'inserció, esborrem la foto per no deixar fitxers orfes
      await admin.storage.from(PHOTO_BUCKET).remove([photoPath]);

      throw new Error("No s'ha pogut desar l'enviament.");
    }

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
