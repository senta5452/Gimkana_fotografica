// Fotos dels equips al bucket privat. Cada foto es desa a
// <game_id>/<team_id>/<fitxer>.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const PHOTO_BUCKET = "submission-photos";

// Temps que funcionen els enllaços temporals per veure les fotos.
const SIGNED_URL_SECONDS = 60 * 60;

// Enllaços temporals per veure les fotos (el bucket és privat).
// Retorna un mapa ruta → enllaç.
export async function signPhotoUrls(admin: SupabaseClient, paths: string[]) {
  const urlByPath = new Map<string, string>();

  if (paths.length === 0) return urlByPath;

  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);

  if (error) {
    throw new Error("No s'han pogut generar els enllaços de les fotos.");
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      urlByPath.set(item.path, item.signedUrl);
    }
  }

  return urlByPath;
}

// Esborra totes les fotos dels equips d'una partida. Si alguna carpeta
// falla, ho deixa al registre i continua. Retorna quantes n'ha esborrat.
export async function removeGamePhotos(
  admin: SupabaseClient,
  gameId: string,
  teamIds: string[],
  logLabel: string,
) {
  let removed = 0;

  for (const teamId of teamIds) {
    const folder = `${gameId}/${teamId}`;
    const { data: files, error: listError } = await admin.storage
      .from(PHOTO_BUCKET)
      .list(folder, { limit: 1000 });

    if (listError) {
      console.error(`${logLabel}: no s'han pogut llistar les fotos`, listError);
      continue;
    }

    const paths = (files ?? []).map((file) => `${folder}/${file.name}`);

    if (paths.length === 0) continue;

    const { error: removeError } = await admin.storage
      .from(PHOTO_BUCKET)
      .remove(paths);

    if (removeError) {
      console.error(`${logLabel}: no s'han pogut esborrar les fotos`, removeError);
      continue;
    }

    removed += paths.length;
  }

  return removed;
}
