import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isDatabaseReady } from "@/lib/admin/db";
import { updateUserPasswordHash } from "./user-service";

export const PASSWORD_RESET_EXPIRATION_MS = 30 * 60 * 1000; // 30 menit
export const PASSWORD_RESET_EXPIRATION_MINUTES = 30;

export interface MemPasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

const globalForReset = globalThis as unknown as {
  __warkopPasswordResetTokens?: Map<string, MemPasswordResetToken>;
};

export function getMemoryResetTokens(): Map<string, MemPasswordResetToken> {
  if (!globalForReset.__warkopPasswordResetTokens) {
    globalForReset.__warkopPasswordResetTokens = new Map<string, MemPasswordResetToken>();
  }
  return globalForReset.__warkopPasswordResetTokens;
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Buat token reset password acak kriptografis (256-bit), simpan hash-nya (SHA-256),
 * dan nonaktifkan token reset lama milik user tersebut yang belum terpakai.
 */
export async function issuePasswordResetToken(userId: string): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_EXPIRATION_MS);

  const memMap = getMemoryResetTokens();
  // Batalkan token sebelumnya yang masih aktif untuk user ini (single active token policy)
  for (const record of memMap.values()) {
    if (record.user_id === userId && record.used_at === null) {
      record.used_at = now;
    }
  }

  memMap.set(tokenHash, {
    id: `prt-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    used_at: null,
    created_at: now,
  });

  if (await isDatabaseReady()) {
    try {
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { user_id: userId, used_at: null },
          data: { used_at: now },
        }),
        prisma.passwordResetToken.create({
          data: {
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt,
          },
        }),
      ]);
    } catch {
      // Tetap gunakan in-memory store bila transaksi DB gagal
    }
  }

  return { rawToken, expiresAt };
}

/**
 * Validasi apakah token reset masih berlaku, ada, dan belum pernah digunakan.
 */
export async function verifyPasswordResetToken(rawToken: string): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  const clean = (rawToken || "").trim();
  if (!clean || clean.length < 32 || !/^[a-f0-9]+$/i.test(clean)) {
    return { valid: false, error: "Tautan reset password tidak valid." };
  }

  const tokenHash = hashResetToken(clean);
  const now = new Date();

  if (await isDatabaseReady()) {
    try {
      const dbRecord = await prisma.passwordResetToken.findUnique({
        where: { token_hash: tokenHash },
      });
      if (dbRecord) {
        if (dbRecord.used_at !== null) {
          return { valid: false, error: "Tautan reset password ini sudah pernah digunakan." };
        }
        if (dbRecord.expires_at <= now) {
          return {
            valid: false,
            error: "Tautan reset password telah kedaluwarsa. Silakan ajukan permintaan baru.",
          };
        }
        return { valid: true, userId: dbRecord.user_id };
      }
    } catch {
      // Fallback ke memory
    }
  }

  const memRecord = getMemoryResetTokens().get(tokenHash);
  if (!memRecord) {
    return { valid: false, error: "Tautan reset password tidak ditemukan atau sudah kedaluwarsa." };
  }
  if (memRecord.used_at !== null) {
    return { valid: false, error: "Tautan reset password ini sudah pernah digunakan." };
  }
  if (memRecord.expires_at <= now) {
    return {
      valid: false,
      error: "Tautan reset password telah kedaluwarsa. Silakan ajukan permintaan baru.",
    };
  }

  return { valid: true, userId: memRecord.user_id };
}

/**
 * Konsumsi token reset password secara atomik (sekali pakai) dan perbarui hash password user.
 */
export async function consumePasswordResetToken(params: {
  rawToken: string;
  newPassword: string;
}): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  const clean = (params.rawToken || "").trim();
  if (!clean || clean.length < 32 || !/^[a-f0-9]+$/i.test(clean)) {
    return { success: false, error: "Token reset password tidak valid." };
  }
  if (!params.newPassword || params.newPassword.length < 6) {
    return { success: false, error: "Password baru minimal terdiri dari 6 karakter." };
  }

  const tokenHash = hashResetToken(clean);
  const now = new Date();
  let targetUserId: string | null = null;

  // 1. Coba klaim token di Database secara atomik (updateMany hanya cocok jika used_at null & belum expired)
  if (await isDatabaseReady()) {
    try {
      const dbRecord = await prisma.passwordResetToken.findUnique({
        where: { token_hash: tokenHash },
      });
      if (dbRecord) {
        if (dbRecord.used_at !== null) {
          return { success: false, error: "Tautan reset password ini sudah pernah digunakan." };
        }
        if (dbRecord.expires_at <= now) {
          return {
            success: false,
            error: "Tautan reset password telah kedaluwarsa. Silakan ajukan ulang.",
          };
        }

        const claimed = await prisma.passwordResetToken.updateMany({
          where: {
            id: dbRecord.id,
            used_at: null,
            expires_at: { gt: now },
          },
          data: { used_at: now },
        });
        if (claimed.count === 0) {
          return {
            success: false,
            error: "Tautan reset password tidak valid atau sudah digunakan.",
          };
        }
        targetUserId = dbRecord.user_id;
      }
    } catch {
      // Fallback ke memory
    }
  }

  // 2. Sinkronkan atau klaim dari memory token store
  const memMap = getMemoryResetTokens();
  const memRecord = memMap.get(tokenHash);
  if (!targetUserId) {
    if (!memRecord) {
      return {
        success: false,
        error: "Tautan reset password tidak ditemukan atau telah kedaluwarsa.",
      };
    }
    if (memRecord.used_at !== null) {
      return { success: false, error: "Tautan reset password ini sudah pernah digunakan." };
    }
    if (memRecord.expires_at <= now) {
      return {
        success: false,
        error: "Tautan reset password telah kedaluwarsa. Silakan ajukan permintaan baru.",
      };
    }
    memRecord.used_at = now;
    targetUserId = memRecord.user_id;
  } else if (memRecord) {
    memRecord.used_at = now;
  }

  const updateRes = await updateUserPasswordHash(targetUserId, params.newPassword);
  if (!updateRes.success) {
    return { success: false, error: updateRes.error || "Gagal memperbarui password." };
  }

  return { success: true, userId: targetUserId };
}

export function resetPasswordResetTokensForTest(): void {
  getMemoryResetTokens().clear();
}
