"use client";

import React, { useState } from "react";
import { Eye, Search, ShieldCheck } from "lucide-react";
import type { AdminAuditLog } from "@/lib/admin/types";
import { formatDateTimeId, ModalFrame } from "./admin-ui";

interface AdminAuditLogTabProps {
  logs: AdminAuditLog[];
  initialEntity: string;
  initialQuery: string;
  onFilterApply: (entity: string, q: string) => void;
}

const ENTITY_OPTIONS = [
  { value: "ALL", label: "Semua Entitas" },
  { value: "auth", label: "Autentikasi (auth)" },
  { value: "categories", label: "Kategori Menu" },
  { value: "products", label: "Produk & Varian" },
  { value: "product_stocks", label: "Stok Porsi" },
  { value: "restaurant_settings", label: "Pengaturan Toko" },
];

function actionBadgeTone(action: string): string {
  if (action.includes("FAILED") || action.includes("DELETE")) {
    return "bg-error/10 text-error border-error/30";
  }
  if (action.includes("CREATE") || action.includes("RESTORE") || action.includes("LOGIN")) {
    return "bg-success/10 text-success border-success/30";
  }
  if (action.includes("STOCK") || action.includes("TOGGLE")) {
    return "bg-warning/15 text-amber-800 border-warning/40";
  }
  return "bg-secondary-bg text-foreground border-border";
}

export function AdminAuditLogTab({
  logs,
  initialEntity,
  initialQuery,
  onFilterApply,
}: AdminAuditLogTabProps) {
  const [entity, setEntity] = useState(initialEntity || "ALL");
  const [query, setQuery] = useState(initialQuery || "");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onFilterApply(entity, query);
        }}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Jejak Audit Aksi Sensitif</h2>
            <p className="text-xs text-muted-foreground">
              Menampilkan {logs.length} rekaman aktivitas admin, stok, dan login terbaru
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={entity}
            onChange={(e) => {
              const next = e.target.value;
              setEntity(next);
              onFilterApply(next, query);
            }}
            aria-label="Filter entitas audit"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
          >
            {ENTITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari aktor, aksi, alasan..."
              className="rounded-xl border border-border bg-background py-2 pr-3 pl-8 text-xs text-foreground"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            Filter
          </button>
          {(entity !== "ALL" || query) && (
            <button
              type="button"
              onClick={() => {
                setEntity("ALL");
                setQuery("");
                onFilterApply("ALL", "");
              }}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Tabel Audit */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary-bg text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aktor</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Entitas</th>
                <th className="px-4 py-3">Alasan / Catatan</th>
                <th className="px-4 py-3 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Belum ada catatan audit log sesuai filter ini. Cobalah mengubah pengaturan
                    toko, stok, atau menu untuk melihat jejak audit terekam otomatis.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {formatDateTimeId(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {log.actorName || "Sistem / Tamu"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {log.actorRole || "PUBLIC"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${actionBadgeTone(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{log.entityName}</p>
                      <p className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground">
                        {log.entityId}
                      </p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      {log.reason || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {log.oldData !== null || log.newData !== null ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary-bg"
                        >
                          <Eye className="h-3 w-3" />
                          Diff
                        </button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Old vs New Data */}
      {selectedLog && (
        <ModalFrame
          title={`Detail Audit · ${selectedLog.action}`}
          subtitle={`${selectedLog.entityName} (${selectedLog.entityId}) · ${formatDateTimeId(
            selectedLog.createdAt,
          )}`}
          maxWidthClass="max-w-2xl"
          onClose={() => setSelectedLog(null)}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-secondary-bg p-3">
              <p className="font-semibold text-foreground">Alasan / Keterangan</p>
              <p className="mt-1 text-muted-foreground">{selectedLog.reason || "-"}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 font-semibold text-foreground">Data Sebelum (Old)</p>
                <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-secondary-bg/50 p-3 font-mono text-[11px] text-foreground">
                  {selectedLog.oldData !== null
                    ? JSON.stringify(selectedLog.oldData, null, 2)
                    : "null (data baru)"}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 font-semibold text-foreground">Data Sesudah (New)</p>
                <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-secondary-bg/50 p-3 font-mono text-[11px] text-foreground">
                  {selectedLog.newData !== null
                    ? JSON.stringify(selectedLog.newData, null, 2)
                    : "null"}
                </pre>
              </div>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
