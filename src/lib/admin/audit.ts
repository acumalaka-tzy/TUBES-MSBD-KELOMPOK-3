import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidateDatabaseCheck, isDatabaseReady, withTimeout } from "./db";
import { getMemoryStore, memoryId } from "./memory-store";

export interface AuditLogInput {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  entityName: string;
  entityId: string;
  action: string;
  oldData?: unknown;
  newData?: unknown;
  reason?: string | null;
}

const MAX_MEMORY_AUDIT_LOGS = 500;
const AUDIT_TIMEOUT_MS = 4000;

function toPlainJson(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

/**
 * Mencatat jejak audit aksi sensitif ke tabel `audit_logs` (MySQL) atau memori.
 * Tidak melempar error ke pemanggil agar aksi utama tidak gagal jika log hanya ke memori,
 * namun selalu mengutamakan penyimpanan DB saat MySQL aktif.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  const safeOld = toPlainJson(input.oldData);
  const safeNew = toPlainJson(input.newData);

  if (await isDatabaseReady()) {
    try {
      let validActorId: string | null = null;
      if (input.actorId) {
        const actor = await withTimeout(
          prisma.user.findUnique({ where: { id: input.actorId }, select: { id: true } }),
          AUDIT_TIMEOUT_MS,
        );
        validActorId = actor?.id ?? null;
      }

      await withTimeout(
        prisma.auditLog.create({
          data: {
            actor_id: validActorId,
            actor_role: input.actorRole ?? "SYSTEM",
            entity_name: input.entityName,
            entity_id: input.entityId,
            action: input.action,
            old_data: safeOld === null ? Prisma.JsonNull : (safeOld as Prisma.InputJsonValue),
            new_data: safeNew === null ? Prisma.JsonNull : (safeNew as Prisma.InputJsonValue),
            reason: input.reason ?? null,
          },
        }),
        AUDIT_TIMEOUT_MS,
      );
      return;
    } catch (err) {
      invalidateDatabaseCheck();
      console.warn(
        "[admin:audit] Gagal menyimpan audit log ke MySQL, menulis ke memori:",
        err instanceof Error ? err.message.split("\n").pop() : err,
      );
    }
  }

  const store = getMemoryStore();
  store.auditLogs.unshift({
    id: memoryId("aud"),
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    actor_role: input.actorRole ?? "SYSTEM",
    entity_name: input.entityName,
    entity_id: input.entityId,
    action: input.action,
    old_data: safeOld,
    new_data: safeNew,
    reason: input.reason ?? null,
    created_at: new Date(),
  });
  if (store.auditLogs.length > MAX_MEMORY_AUDIT_LOGS) {
    store.auditLogs.length = MAX_MEMORY_AUDIT_LOGS;
  }
}
