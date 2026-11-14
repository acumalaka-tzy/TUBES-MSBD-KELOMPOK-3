import { cookies } from "next/headers";
import { signAuthToken, verifyAuthToken, type AuthTokenPayload, type AuthUser, type UserRole } from "./jwt";
import { hasRole } from "./rbac";

export const AUTH_COOKIE_NAME = "warkop_auth_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 hari

/**
 * Menyimpan sesi pengguna ke dalam HTTP-Only Cookie
 */
export async function createSession(user: AuthUser): Promise<string> {
  const token = await signAuthToken({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return token;
}

/**
 * Mengambil dan memvalidasi sesi pengguna aktif dari cookie
 */
export async function getSession(): Promise<AuthTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}

/**
 * Menghapus cookie sesi (Logout)
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Helper Server-side: Memastikan pengguna sudah login
 */
export async function requireAuth(): Promise<AuthTokenPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED: Anda harus login untuk mengakses sumber daya ini.");
  }
  return session;
}

/**
 * Helper Server-side: Memastikan pengguna memiliki role yang diizinkan (RBAC)
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthTokenPayload> {
  const session = await requireAuth();
  if (!hasRole(session.role, allowedRoles)) {
    throw new Error(
      `FORBIDDEN: Akses ditolak. Role "${session.role}" tidak memiliki izin yang diperlukan.`
    );
  }
  return session;
}

