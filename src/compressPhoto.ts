// Redueix una foto abans de pujar-la: costat llarg de 1600 px com a màxim i
// format JPEG. Si el navegador no la pot processar, o la reducció no fa
// el fitxer més petit, es retorna la foto original.

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    // "from-image" respecta l'orientació que guarda la càmera del mòbil.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const scale = Math.min(
      1,
      MAX_SIDE / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    // Fons blanc perquè les zones transparents (PNG) no surtin negres.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );

    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";

    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch (error) {
    console.warn("No s'ha pogut reduir la foto; s'envia l'original.", error);
    return file;
  }
}
