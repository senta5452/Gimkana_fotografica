// Enllaços a les fotos del bucket.
//
// El servidor genera un enllaç temporal nou (vàlid 1 hora) a cada consulta
// de 5 s. Cada enllaç és diferent i el navegador el tractaria com una
// imatge nova: tornaria a descarregar totes les fotos cada 5 s i gastaria
// molt "storage egress" de Supabase. Per evitar-ho, es fa servir el primer
// enllaç rebut de cada foto mentre encara és vàlid; així el navegador la
// descarrega una sola vegada i després la treu de la seva memòria cau.

// Es renova abans que caduqui (l'enllaç dura 60 minuts).
const REUSE_MS = 50 * 60 * 1000;

export type PhotoUrlCache = Map<string, { url: string; receivedAt: number }>;

export function keepPhotoUrls<T extends { id: string; photoUrl?: string }>(
  cache: PhotoUrlCache,
  items: T[]
): T[] {
  const now = Date.now();

  return items.map((item) => {
    if (!item.photoUrl) return item;

    const cached = cache.get(item.id);

    if (cached && now - cached.receivedAt < REUSE_MS) {
      return { ...item, photoUrl: cached.url };
    }

    cache.set(item.id, { url: item.photoUrl, receivedAt: now });
    return item;
  });
}
