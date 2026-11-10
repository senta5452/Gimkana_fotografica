// PIN dels equips: 8 xifres aleatòries, desat com a hash PBKDF2
// ("sal:hash" en hexadecimal). create-game i judge-regenerate-pin el creen;
// join-game el comprova.

const PBKDF2_ITERATIONS = 310_000;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Hash invàlid");
  }

  return new Uint8Array(hex.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );

  return new Uint8Array(bits);
}

export function randomPin() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = new DataView(bytes.buffer).getUint32(0);
  return String(value % 100_000_000).padStart(8, "0");
}

export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${toHex(salt)}:${toHex(await derive(pin, salt))}`;
}

// Compara el PIN amb el hash desat, sense revelar on difereixen.
export async function verifyPin(pin: string, stored: string) {
  const parts = stored.split(":");
  if (parts.length !== 2 || !/^[0-9]{8}$/.test(pin)) return false;

  try {
    const salt = fromHex(parts[0]);
    const expected = fromHex(parts[1]);
    const result = await derive(pin, salt);

    if (result.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < result.length; i++) diff |= result[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
