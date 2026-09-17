import argon2 from "argon2";

// OWASP recomenda Argon2id com pelo menos 19 MiB, t=2 e p=1.
// Este custo maior deve ser revisado com medições no ambiente de produção.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_BYTES = 1024;

export function validateNewPassword(password: unknown): asserts password is string {
  if (typeof password !== "string") throw new Error("Senha inválida.");
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    throw new Error("A senha ultrapassa o tamanho máximo permitido.");
  }
  if ([...password].length < PASSWORD_MIN_LENGTH || password.trim().length === 0) {
    throw new Error(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
}

export async function hashPassword(password: unknown): Promise<string> {
  validateNewPassword(password);
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return false;
  if (!hash.startsWith("$argon2id$")) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
