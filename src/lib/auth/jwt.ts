import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type UserRole = "ADMIN" | "CASHIER" | "CUSTOMER";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthTokenPayload extends JWTPayload {
  sub: string; // User ID
  name: string;
  email?: string | null;
  phone: string;
  role: UserRole;
}

const DEFAULT_SECRET = "warkop-agam-secret-jwt-key-2026-msbd-tubes";
const JWT_EXPIRES_IN = "7d"; // 7 hari

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Menghasilkan JWT token terenkripsi HMAC-SHA256
 */
export async function signAuthToken(
  user: Pick<AuthUser, "id" | "name" | "email" | "phone" | "role">,
  expiresIn: string = JWT_EXPIRES_IN
): Promise<string> {
  const secretKey = getJwtSecretKey();

  return await new SignJWT({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Verifikasi token JWT dan mengembalikan payload jika valid
 */
export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (!payload.sub || !payload.role) {
      return null;
    }

    return {
      ...payload,
      sub: payload.sub as string,
      name: (payload.name as string) || "",
      email: (payload.email as string | null) || null,
      phone: (payload.phone as string) || "",
      role: payload.role as UserRole,
    };
  } catch {
    // Token kedaluwarsa atau signature tidak valid
    return null;
  }
}

