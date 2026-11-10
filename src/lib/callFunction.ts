import { supabase } from "./supabase";

export type FunctionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// Crida una Edge Function. Si falla, retorna el missatge d'error que envia
// el servidor (o `fallbackError` si no n'hi ha) i en deixa el detall a la
// consola. Si el monitor ha iniciat sessió, supabase-js hi afegeix el JWT.
export async function callFunction<T>(
  name: string,
  body: unknown,
  fallbackError: string
): Promise<FunctionResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body: body as Record<string, unknown> | FormData,
    });

    if (!error) return { data: data as T, error: null };

    let message = fallbackError;

    if (error.context instanceof Response) {
      const detail = await error.context.text();
      console.error(`${name}:`, error.message, detail);

      try {
        message = JSON.parse(detail).error ?? fallbackError;
      } catch {
        // La resposta no és JSON: mantenim el missatge genèric.
      }
    } else {
      console.error(`${name}:`, error);
    }

    return { data: null, error: message };
  } catch (error) {
    console.error(`${name}:`, error);
    return { data: null, error: fallbackError };
  }
}
