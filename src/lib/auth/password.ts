import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hash password menggunakan bcrypt dengan cost factor 10
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Bandingkan password plain text dengan password hash
 */
export async function comparePassword(
  plainText: string,
  hashedPassword: string | null | undefined
): Promise<boolean> {
  if (!hashedPassword) return false;
  return bcrypt.compare(plainText, hashedPassword);
}

