"use client";

import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  AlertCircle,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  createTableAction,
  updateTableAction,
  toggleTableStatusAction,
  regenerateTableQrAction,
  deleteTableAction,
  type CreateTableInput,
  type UpdateTableInput,
} from "@/app/actions/admin";
import type { AdminTable } from "@/lib/admin/types";
import { formatDateTimeId, ModalFrame } from "./admin-ui";

interface AdminTablesTabProps {
  tables: AdminTable[];
  onNotify: (type: "success" | "error", text: string) => void;
  onRefresh: () => void;
}

type TableFilter = "ALL" | "AVAILABLE" | "OCCUPIED" | "INACTIVE";

export function AdminTablesTab({
  tables,
  onNotify,
  onRefresh,
}: AdminTablesTabProps) {
  const [filter, setFilter] = useState<TableFilter>("ALL");
  const [search, setSearch] = useState("");

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTable, setEditTable] = useState<AdminTable | null>(null);
  const [printTable, setPrintTable] = useState<AdminTable | null>(null);
  const [regenTarget, setRegenTarget] = useState<AdminTable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTable | null>(null);

  // Form State Tambah Meja
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Form State Edit Meja
  const [editTableNumber, setEditTableNumber] = useState("");
  const [editTableName, setEditTableName] = useState("");
  const [editCapacity, setEditCapacity] = useState("4");
  const [editStatus, setEditStatus] = useState<"AVAILABLE" | "OCCUPIED" | "INACTIVE">("AVAILABLE");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // QR Print State
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [submittingRegen, setSubmittingRegen] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Base URL untuk QR Link
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Filtered list
  const filteredTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (filter === "AVAILABLE" && (t.status !== "AVAILABLE" || !t.isActive)) return false;
      if (filter === "OCCUPIED" && t.status !== "OCCUPIED") return false;
      if (filter === "INACTIVE" && t.isActive && t.status !== "INACTIVE") return false;

      if (!q) return true;
      return (
        t.tableNumber.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
      );
    });
  }, [tables, filter, search]);

  // Hitung stats
  const totalTables = tables.length;
  const availableCount = tables.filter((t) => t.isActive && t.status === "AVAILABLE").length;
  const occupiedCount = tables.filter((t) => t.status === "OCCUPIED").length;
  const inactiveCount = tables.filter((t) => !t.isActive || t.status === "INACTIVE").length;

  // Generate QR code saat modal print dibuka
  useEffect(() => {
    if (!printTable) {
      setQrDataUrl("");
      setCopiedUrl(false);
      return;
    }

    const host = origin || "http://localhost:3000";
    const qrUrl = printTable.activeQrToken
      ? `${host}/menu?table=${encodeURIComponent(printTable.tableNumber)}&token=${encodeURIComponent(printTable.activeQrToken)}`
      : `${host}/menu?table=${encodeURIComponent(printTable.tableNumber)}`;

    QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#1c1917",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Gagal membuat QR Code:", err));
  }, [printTable, origin]);

  // Handler: Tambah Meja
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      onNotify("error", "Nomor meja wajib diisi.");
      return;
    }
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) {
      onNotify("error", "Kapasitas minimal 1 orang.");
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await createTableAction({
        tableNumber: tableNumber.trim(),
        name: tableName.trim() || `Meja ${tableNumber.trim()}`,
        capacity: cap,
        status: "AVAILABLE",
      });

      if (!res.success) {
        onNotify("error", res.error || "Gagal menambahkan meja.");
      } else {
        onNotify("success", res.message || "Meja berhasil ditambahkan.");
        setIsAddOpen(false);
        setTableNumber("");
        setTableName("");
        setCapacity("4");
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem saat membuat meja.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handler: Open Edit
  const openEditModal = (t: AdminTable) => {
    setEditTable(t);
    setEditTableNumber(t.tableNumber);
    setEditTableName(t.name);
    setEditCapacity(t.capacity.toString());
    setEditStatus(t.status);
  };

  // Handler: Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTable) return;

    const cap = parseInt(editCapacity, 10);
    if (isNaN(cap) || cap < 1) {
      onNotify("error", "Kapasitas minimal 1 orang.");
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await updateTableAction({
        id: editTable.id,
        tableNumber: editTableNumber.trim(),
        name: editTableName.trim() || `Meja ${editTableNumber.trim()}`,
        capacity: cap,
        status: editStatus,
        isActive: editStatus !== "INACTIVE",
      });

      if (!res.success) {
        onNotify("error", res.error || "Gagal memperbarui meja.");
      } else {
        onNotify("success", res.message || "Data meja berhasil diperbarui.");
        setEditTable(null);
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem saat memperbarui meja.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handler: Toggle Status Meja
  const handleToggleStatus = async (t: AdminTable) => {
    const nextStatus = !t.isActive;
    try {
      const res = await toggleTableStatusAction(t.id, nextStatus);
      if (!res.success) {
        onNotify("error", res.error || "Gagal mengubah status meja.");
      } else {
        onNotify("success", res.message || "Status meja berhasil diperbarui.");
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan koneksi.");
    }
  };

  // Handler: Regenerasi QR Token
  const handleRegenerateQr = async () => {
    if (!regenTarget) return;
    setSubmittingRegen(true);
    try {
      const res = await regenerateTableQrAction(regenTarget.id);
      if (!res.success) {
        onNotify("error", res.error || "Gagal membuat ulang QR code.");
      } else {
        onNotify("success", res.message || "QR Code berhasil diperbarui.");
        setRegenTarget(null);
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem.");
    } finally {
      setSubmittingRegen(false);
    }
  };

  // Handler: Hapus Meja
  const handleDeleteTable = async () => {
    if (!deleteTarget) return;
    setSubmittingDelete(true);
    try {
      const res = await deleteTableAction(deleteTarget.id);
      if (!res.success) {
        onNotify("error", res.error || "Gagal menghapus meja.");
      } else {
        onNotify("success", res.message || "Meja berhasil dihapus.");
        setDeleteTarget(null);
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Copy QR URL ke clipboard
  const handleCopyLink = () => {
    if (!printTable) return;
    const host = origin || "http://localhost:3000";
    const fullUrl = printTable.activeQrToken
      ? `${host}/menu?table=${encodeURIComponent(printTable.tableNumber)}&token=${encodeURIComponent(printTable.activeQrToken)}`
      : `${host}/menu?table=${encodeURIComponent(printTable.tableNumber)}`;

    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Download QR Code PNG
  const handleDownloadQr = () => {
    if (!qrDataUrl || !printTable) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_Meja_${printTable.tableNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Print Sticker QR Meja
  const handlePrintSticker = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Status Meja */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E7E5E3] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#78716c]">Total Meja</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#272727]">{totalTables}</span>
            <span className="text-xs text-[#78716c]">Unit</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-800">Tersedia (Siap)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">{availableCount}</span>
            <span className="text-xs text-emerald-700">Meja</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-800">Terisi (Dine In)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-700">{occupiedCount}</span>
            <span className="text-xs text-amber-700">Meja</span>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-600">Nonaktif / Rusak</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-stone-700">{inactiveCount}</span>
            <span className="text-xs text-stone-600">Meja</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E7E5E3] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716c]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor atau nama meja..."
              className="w-full rounded-lg border border-[#E7E5E3] bg-[#F6F4F2]/50 py-2 pl-9 pr-3 text-sm text-[#272727] placeholder-[#78716c] focus:border-[#F16F62] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[#E7E5E3] bg-[#F6F4F2]/60 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                filter === "ALL" ? "bg-white text-[#272727] shadow-sm font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilter("AVAILABLE")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                filter === "AVAILABLE" ? "bg-emerald-600 text-white font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Tersedia
            </button>
            <button
              type="button"
              onClick={() => setFilter("OCCUPIED")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                filter === "OCCUPIED" ? "bg-amber-600 text-white font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Terisi
            </button>
            <button
              type="button"
              onClick={() => setFilter("INACTIVE")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                filter === "INACTIVE" ? "bg-stone-700 text-white font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Nonaktif
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setTableNumber("");
            setTableName("");
            setCapacity("4");
            setIsAddOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F16F62] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d85e52]"
        >
          <Plus className="h-4 w-4" />
          Tambah Meja
        </button>
      </div>

      {/* Grid Kartu Meja */}
      {filteredTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E7E5E3] bg-white py-16 text-center">
          <QrCode className="h-10 w-10 text-[#78716c]/60" />
          <h3 className="mt-3 text-base font-semibold text-[#272727]">Tidak ada meja yang sesuai</h3>
          <p className="mt-1 text-sm text-[#78716c]">
            {search ? "Coba ubah kata kunci pencarian Anda." : "Belum ada data meja. Tambahkan meja baru untuk memulai."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTables.map((table) => {
            const isAvailable = table.isActive && table.status === "AVAILABLE";
            const isOccupied = table.status === "OCCUPIED";

            return (
              <div
                key={table.id}
                className="group relative flex flex-col justify-between rounded-xl border border-[#E7E5E3] bg-white p-5 shadow-sm transition hover:border-[#F16F62]/50 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: Meja Number & Status Badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center rounded-lg bg-[#272727] px-2.5 py-1 text-xs font-bold text-white tracking-wide">
                          MEJA {table.tableNumber}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-[#78716c]">
                          <Users className="h-3.5 w-3.5" />
                          {table.capacity} org
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-semibold text-[#272727] line-clamp-1">
                        {table.name}
                      </h4>
                    </div>

                    <div>
                      {isAvailable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Tersedia
                        </span>
                      )}
                      {isOccupied && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                          Terisi
                        </span>
                      )}
                      {!table.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                          Nonaktif
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Token Info Box */}
                  <div className="mt-4 rounded-lg bg-[#F6F4F2] p-3 text-xs">
                    <div className="flex items-center justify-between text-[#78716c]">
                      <span>Token QR Aktif:</span>
                      <span className="font-mono font-medium text-[#272727]">
                        {table.activeQrToken ? `${table.activeQrToken.slice(0, 12)}...` : "Belum di-generate"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#78716c]">
                      Diperbarui: {formatDateTimeId(table.updatedAt)}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="mt-5 pt-4 border-t border-[#E7E5E3] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Tombol Cetak / Tampilkan QR */}
                    <button
                      type="button"
                      onClick={() => setPrintTable(table)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E3] bg-white px-3 py-1.5 text-xs font-semibold text-[#272727] shadow-sm hover:border-[#F16F62] hover:text-[#F16F62] transition"
                      title="Lihat & Cetak Stiker Meja"
                    >
                      <QrCode className="h-3.5 w-3.5 text-[#F16F62]" />
                      Cetak QR
                    </button>

                    {/* Tombol Regenerasi Token */}
                    <button
                      type="button"
                      onClick={() => setRegenTarget(table)}
                      className="rounded-lg border border-[#E7E5E3] bg-white p-1.5 text-[#78716c] hover:border-amber-400 hover:text-amber-700 transition"
                      title="Regenerasi Token QR (Hanguskan QR Lama)"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Meja */}
                    <button
                      type="button"
                      onClick={() => openEditModal(table)}
                      className="rounded-lg border border-[#E7E5E3] bg-white p-1.5 text-[#78716c] hover:border-[#272727] hover:text-[#272727] transition"
                      title="Edit Data Meja"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Sakelar Aktif/Nonaktif */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(table)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                        table.isActive
                          ? "bg-stone-100 text-stone-700 hover:bg-rose-50 hover:text-rose-600"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                      title={table.isActive ? "Nonaktifkan Meja" : "Aktifkan Meja"}
                    >
                      {table.isActive ? "Off" : "On"}
                    </button>

                    {/* Hapus Meja */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(table)}
                      className="rounded-lg border border-[#E7E5E3] bg-white p-1.5 text-[#78716c] hover:border-rose-400 hover:text-rose-600 transition"
                      title="Hapus Meja"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah Meja */}
      {isAddOpen && (
        <ModalFrame title="Tambah Meja Baru" onClose={() => setIsAddOpen(false)}>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Nomor Meja <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Contoh: 07 atau VIP-1"
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
              <p className="mt-1 text-xs text-[#78716c]">
                Nomor meja digunakan sebagai identitas unik pada QR Code.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Nama / Label Meja
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Contoh: Meja Depan Kasir / Sudut Luar"
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Kapasitas Kursi (Orang) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
              <QrCode className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                Token QR kriptografis otomatis digenerate begitu meja berhasil dibuat. Anda dapat langsung mencetak stiker QR meja.
              </span>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg border border-[#E7E5E3] px-4 py-2 text-sm font-medium text-[#78716c] hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingAdd}
                className="rounded-lg bg-[#F16F62] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#d85e52] disabled:opacity-50"
              >
                {submittingAdd ? "Menyimpan..." : "Simpan Meja"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* Modal Edit Meja */}
      {editTable && (
        <ModalFrame title={`Edit Data Meja ${editTable.tableNumber}`} onClose={() => setEditTable(null)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Nomor Meja <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editTableNumber}
                onChange={(e) => setEditTableNumber(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Nama / Label Meja
              </label>
              <input
                type="text"
                value={editTableName}
                onChange={(e) => setEditTableName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                  Kapasitas
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                  Status Meja
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] bg-white px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                >
                  <option value="AVAILABLE">Tersedia (Ready)</option>
                  <option value="OCCUPIED">Terisi (Dine In)</option>
                  <option value="INACTIVE">Nonaktif (Off)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTable(null)}
                className="rounded-lg border border-[#E7E5E3] px-4 py-2 text-sm font-medium text-[#78716c] hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="rounded-lg bg-[#F16F62] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#d85e52] disabled:opacity-50"
              >
                {submittingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* Modal Cetak Stiker QR Meja Siap Tempel */}
      {printTable && (
        <ModalFrame
          title={`Cetak Stiker QR Meja ${printTable.tableNumber}`}
          onClose={() => setPrintTable(null)}
        >
          <div className="space-y-4">
            {/* Area Stiker Meja Siap Cetak (Diberi id untuk print) */}
            <div
              id="printable-qr-sticker"
              className="mx-auto max-w-sm rounded-2xl border-2 border-dashed border-[#272727] bg-white p-6 text-center shadow-md print:border-none print:shadow-none"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-black tracking-widest text-[#F16F62] uppercase">
                  WARKOP AGAM
                </span>
              </div>
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-widest">
                Kelezatan Autentik Khas Medan
              </p>

              <div className="my-3 border-y border-stone-200 py-2">
                <span className="text-3xl font-black text-[#272727] tracking-tight">
                  MEJA {printTable.tableNumber}
                </span>
                <p className="text-xs text-stone-600 font-medium mt-0.5">
                  {printTable.name} • Kapasitas {printTable.capacity} Orang
                </p>
              </div>

              {/* QR Image */}
              <div className="mx-auto my-3 flex justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Meja ${printTable.tableNumber}`}
                    className="h-56 w-56 rounded-xl border border-stone-200 p-2 shadow-inner"
                  />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                    Membuat QR Code...
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-stone-50 p-2 text-stone-700">
                <p className="text-xs font-bold uppercase tracking-wider text-[#272727]">
                  Pindai QR Untuk Memesan
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Buka kamera HP atau aplikasi scanner untuk melihat menu & memesan langsung.
                </p>
              </div>

              <p className="mt-3 text-[10px] text-stone-400 font-mono">
                Token: {printTable.activeQrToken ? `${printTable.activeQrToken.slice(0, 16)}...` : "-"}
              </p>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-col gap-2 rounded-xl border border-[#E7E5E3] bg-[#F6F4F2] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#78716c]">Tautan URL Dine In:</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 font-semibold text-[#F16F62] hover:underline"
                >
                  {copiedUrl ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Salin Link
                    </>
                  )}
                </button>
              </div>
              <p className="break-all font-mono text-[11px] text-stone-600 bg-white p-2 rounded border border-[#E7E5E3]">
                {origin || "http://localhost:3000"}/menu?table={encodeURIComponent(printTable.tableNumber)}
                {printTable.activeQrToken ? `&token=${printTable.activeQrToken}` : ""}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E3] bg-white px-3 py-2 text-xs font-semibold text-[#272727] hover:bg-stone-50"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh PNG
              </button>

              <button
                type="button"
                onClick={handlePrintSticker}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#272727] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Stiker Meja (Print)
              </button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* Modal Konfirmasi Regenerasi QR */}
      {regenTarget && (
        <ModalFrame
          title={`Regenerasi QR Meja ${regenTarget.tableNumber}`}
          onClose={() => setRegenTarget(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">
                  Perhatian: QR Code Lama Akan Langsung Hangus!
                </p>
                <p className="mt-1 leading-relaxed">
                  Tindakan ini akan membuat token kriptografis baru untuk Meja {regenTarget.tableNumber}.
                  Stiker QR lama yang ditempel di meja tidak akan dapat digunakan lagi untuk pemesanan dine in demi keamanan.
                </p>
              </div>
            </div>

            <p className="text-sm text-[#78716c]">
              Setelah regenerasi selesai, Anda harus mencetak ulang stiker QR Meja baru dan menempelkannya di meja fisik.
            </p>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setRegenTarget(null)}
                className="rounded-lg border border-[#E7E5E3] px-4 py-2 text-sm font-medium text-[#78716c] hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submittingRegen}
                onClick={handleRegenerateQr}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {submittingRegen ? "Memproses..." : "Ya, Regenerasi QR Baru"}
              </button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* Modal Konfirmasi Hapus Meja */}
      {deleteTarget && (
        <ModalFrame
          title={`Hapus Meja ${deleteTarget.tableNumber}`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-[#272727]">
              Apakah Anda yakin ingin menghapus <strong>Meja {deleteTarget.tableNumber} ({deleteTarget.name})</strong>?
            </p>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Catatan: Jika meja ini memiliki riwayat transaksi pemesanan terdahulu, sistem akan otomatis melakukan <em>soft-deactivation</em> (menonaktifkan meja) agar integritas laporan omzet dan data historis penjualan tidak hilang.
            </p>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#E7E5E3] px-4 py-2 text-sm font-medium text-[#78716c] hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submittingDelete}
                onClick={handleDeleteTable}
                className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {submittingDelete ? "Menghapus..." : "Ya, Hapus / Nonaktifkan"}
              </button>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}