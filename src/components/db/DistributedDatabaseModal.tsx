"use client";

import React, { useEffect, useState } from "react";
import {
  Database,
  Server,
  Layers,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Cpu,
  HardDrive,
  Workflow,
  X,
  Activity,
  Zap,
} from "lucide-react";
import type { DistributedClusterInfo } from "@/lib/db/distributed";

interface DistributedDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DistributedDatabaseModal({
  isOpen,
  onClose,
}: DistributedDatabaseModalProps) {
  const [cluster, setCluster] = useState<DistributedClusterInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/distributed-db/status");
      const data = await res.json();
      if (data.success && data.cluster) {
        setCluster(data.cluster);
      } else {
        setError(data.error || "Gagal memuat status cluster.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal terhubung ke API cluster.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0F172A] text-slate-100 shadow-2xl animate-fade-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#1E293B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Arsitektur Basis Data Terdistribusi (MSBD)
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Cluster
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                TiDB NewSQL / MySQL InnoDB Cluster • Two-Phase Commit &amp; Multi-Raft
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={isLoading}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
              title="Refresh status cluster"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {isLoading && !cluster ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-xs text-slate-400 font-medium">Memeriksa topologi distributed cluster...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300">
              <p className="font-bold">Error Terhubung ke Database:</p>
              <p className="mt-1 font-mono text-[11px]">{error}</p>
            </div>
          ) : cluster ? (
            <>
              {/* Status Header Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-[#1E293B]/60 p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engine Aktif</span>
                  <p className="mt-1 text-sm font-extrabold text-white truncate">{cluster.engine}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-emerald-400 truncate">{cluster.version}</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#1E293B]/60 p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tingkat Isolasi (ACID)</span>
                  <p className="mt-1 font-mono text-sm font-extrabold text-amber-400">{cluster.isolationLevel}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">Pessimistic Locking</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#1E293B]/60 p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latensi Commit Node</span>
                  <p className="mt-1 font-mono text-sm font-extrabold text-emerald-400">{cluster.latencyMs} ms</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">Linearizable Read/Write</p>
                </div>
              </div>

              {/* Arsitektur 4-Layer (Compute, Storage, Consensus, Analytics) */}
              <div className="rounded-xl border border-slate-800 bg-[#1E293B]/30 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  Topologi Lapisan Terdistribusi
                </h4>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>Compute Layer (Stateless)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {cluster.architecture.computeLayer}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2 text-sky-400 font-bold mb-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>Storage Layer (Sharded)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {cluster.architecture.storageLayer}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2 text-purple-400 font-bold mb-1">
                      <Workflow className="h-3.5 w-3.5" />
                      <span>Protokol Konsensus (Quorum)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {cluster.architecture.consensusProtocol}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
                      <Activity className="h-3.5 w-3.5" />
                      <span>Analytical Engine (MPP / OLAP)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {cluster.architecture.analyticalEngine}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fitur & Mekanisme Pengendalian Konkurensi */}
              <div className="rounded-xl border border-slate-800 bg-[#1E293B]/30 p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Mekanisme Konsistensi &amp; Ketahanan Transaksi
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Two-Phase Commit (2PC) Transactions</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Distributed Write-Conflict Backoff &amp; Jitter</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Row-Level Lock (SELECT ... FOR UPDATE)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Multi-Raft Leader Election (RPO = 0, RTO &lt; 3s)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Distributed Table Session &amp; Idempotency Keys</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Non-Hotspot Key Sharding (UUID v4)</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-[#1E293B] px-6 py-3.5 text-xs text-slate-400">
          <span>Target DB: TiDB v7.5+ / MySQL 8.0 Cluster</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-white hover:bg-slate-700 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
