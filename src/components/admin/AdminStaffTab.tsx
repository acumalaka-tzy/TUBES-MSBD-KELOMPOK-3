"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  createStaffAction,
  updateStaffAction,
  toggleStaffStatusAction,
  resetStaffPasswordAction,
  deleteStaffAction,
  type CreateStaffInput,
  type UpdateStaffInput,
} from "@/app/actions/admin";
import type { AdminStaffUser } from "@/lib/admin/types";
import { formatDateTimeId, ModalFrame } from "./admin-ui";

interface AdminStaffTabProps {
  staff: AdminStaffUser[];
  currentAdminId?: string;
  onNotify: (type: "success" | "error", text: string) => void;
  onRefresh: () => void;
}

type StaffRoleFilter = "ALL" | "CASHIER" | "ADMIN";

export function AdminStaffTab({
  staff,
  currentAdminId,
  onNotify,
  onRefresh,
}: AdminStaffTabProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRoleFilter>("ALL");

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<AdminStaffUser | null>(null);
  const [resetStaff, setResetStaff] = useState<AdminStaffUser | null>(null);
  const [deleteStaff, setDeleteStaff] = useState<AdminStaffUser | null>(null);

  // Form State Tambah Staf
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"CASHIER" | "ADMIN">("CASHIER");
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Form State Edit Staf
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"CASHIER" | "ADMIN">("CASHIER");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Form State Reset Password
  const [newPassword, setNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);

  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Filtered List
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q))
      );
    });
  }, [staff, roleFilter, search]);

  // Stats
  const totalStaff = staff.length;
  const cashierCount = staff.filter((u) => u.role === "CASHIER").length;
  const activeCount = staff.filter((u) => u.isActive).length;
  const inactiveCount = staff.filter((u) => !u.isActive).length;

  // Handler: Tambah Staf
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      onNotify("error", "Nama lengkap wajib diisi.");
      return;
    }
    if (!addPhone.trim()) {
      onNotify("error", "Nomor WhatsApp wajib diisi.");
      return;
    }
    if (addPassword.length < 6) {
      onNotify("error", "Password minimal 6 karakter.");
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await createStaffAction({
        name: addName.trim(),
        phone: addPhone.trim(),
        email: addEmail.trim() || undefined,
        password: addPassword,
        role: addRole,
      });

      if (!res.success) {
        onNotify("error", res.error || "Gagal membuat akun staf.");
      } else {
        onNotify("success", res.message || "Akun staf berhasil dibuat.");
        setIsAddOpen(false);
        setAddName("");
        setAddPhone("");
        setAddEmail("");
        setAddPassword("");
        setAddRole("CASHIER");
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem saat membuat akun staf.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handler: Buka Modal Edit
  const openEditModal = (u: AdminStaffUser) => {
    setEditStaff(u);
    setEditName(u.name);
    setEditPhone(u.phone);
    setEditEmail(u.email || "");
    setEditRole(u.role === "ADMIN" ? "ADMIN" : "CASHIER");
  };

  // Handler: Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;

    setSubmittingEdit(true);
    try {
      const res = await updateStaffAction({
        userId: editStaff.id,
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        role: editRole,
      });

      if (!res.success) {
        onNotify("error", res.error || "Gagal memperbarui staf.");
      } else {
        onNotify("success", res.message || "Data staf berhasil diperbarui.");
        setEditStaff(null);
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handler: Toggle Status Aktif Staf
  const handleToggleStatus = async (u: AdminStaffUser) => {
    if (currentAdminId && u.id === currentAdminId) {
      onNotify("error", "Anda tidak dapat menonaktifkan akun Administrator Anda sendiri.");
      return;
    }

    const nextActive = !u.isActive;
    try {
      const res = await toggleStaffStatusAction(u.id, nextActive);
      if (!res.success) {
        onNotify("error", res.error || "Gagal mengubah status staf.");
      } else {
        onNotify("success", res.message || "Status akun staf berhasil diperbarui.");
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan koneksi.");
    }
  };

  // Handler: Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaff) return;
    if (newPassword.length < 6) {
      onNotify("error", "Password baru minimal 6 karakter.");
      return;
    }

    setSubmittingReset(true);
    try {
      const res = await resetStaffPasswordAction({
        userId: resetStaff.id,
        newPassword: newPassword,
      });

      if (!res.success) {
        onNotify("error", res.error || "Gagal me-reset password.");
      } else {
        onNotify("success", res.message || "Password staf berhasil direset.");
        setResetStaff(null);
        setNewPassword("");
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem.");
    } finally {
      setSubmittingReset(false);
    }
  };

  // Handler: Deaktivasi Staf
  const handleDeleteStaff = async () => {
    if (!deleteStaff) return;
    setSubmittingDelete(true);
    try {
      const res = await deleteStaffAction(deleteStaff.id);
      if (!res.success) {
        onNotify("error", res.error || "Gagal menonaktifkan staf.");
      } else {
        onNotify("success", res.message || "Akun staf berhasil dinonaktifkan.");
        setDeleteStaff(null);
        onRefresh();
      }
    } catch {
      onNotify("error", "Terjadi kesalahan sistem.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Staf */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E7E5E3] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#78716c]">Total Tim / Staf</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#272727]">{totalStaff}</span>
            <span className="text-xs text-[#78716c]">Orang</span>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-sky-800">Akun Kasir (POS)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-700">{cashierCount}</span>
            <span className="text-xs text-sky-700">Akun</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-800">Staf Aktif (Bisa Login)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">{activeCount}</span>
            <span className="text-xs text-emerald-700">Akun</span>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-stone-600">Dinonaktifkan</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-stone-700">{inactiveCount}</span>
            <span className="text-xs text-stone-600">Akun</span>
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
              placeholder="Cari nama, no HP, atau email..."
              className="w-full rounded-lg border border-[#E7E5E3] bg-[#F6F4F2]/50 py-2 pl-9 pr-3 text-sm text-[#272727] placeholder-[#78716c] focus:border-[#F16F62] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[#E7E5E3] bg-[#F6F4F2]/60 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setRoleFilter("ALL")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                roleFilter === "ALL" ? "bg-white text-[#272727] shadow-sm font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Semua Role
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("CASHIER")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                roleFilter === "CASHIER" ? "bg-sky-600 text-white font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Kasir Saja
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("ADMIN")}
              className={`rounded-md px-2.5 py-1.5 transition ${
                roleFilter === "ADMIN" ? "bg-[#272727] text-white font-semibold" : "text-[#78716c] hover:text-[#272727]"
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setAddName("");
            setAddPhone("");
            setAddEmail("");
            setAddPassword("");
            setAddRole("CASHIER");
            setShowAddPassword(false);
            setIsAddOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F16F62] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d85e52]"
        >
          <Plus className="h-4 w-4" />
          Tambah Akun Staf
        </button>
      </div>

      {/* Tabel Staf */}
      <div className="overflow-hidden rounded-xl border border-[#E7E5E3] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#272727]">
            <thead className="border-b border-[#E7E5E3] bg-[#F6F4F2] text-xs font-bold uppercase tracking-wider text-[#78716c]">
              <tr>
                <th className="px-5 py-3.5">Nama Staf & Kontak</th>
                <th className="px-5 py-3.5">Peran (Role)</th>
                <th className="px-5 py-3.5">Status Akun</th>
                <th className="px-5 py-3.5">Terdaftar Sejak</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E3]">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#78716c]">
                    Tidak ada akun staf yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((u) => {
                  const isCurrentAdmin = currentAdminId && u.id === currentAdminId;

                  return (
                    <tr key={u.id} className="transition hover:bg-stone-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F4F2] text-sm font-bold text-[#F16F62] border border-[#E7E5E3]">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#272727]">{u.name}</span>
                              {isCurrentAdmin && (
                                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#78716c] mt-0.5">
                              WA: <span className="font-mono">{u.phone}</span>
                              {u.email && (
                                <span className="ml-2 font-mono">• {u.email}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {u.role === "ADMIN" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                            <ShieldCheck className="h-3 w-3 text-amber-400" />
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                            <Users className="h-3 w-3" />
                            Kasir POS
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={Boolean(isCurrentAdmin)}
                            onClick={() => handleToggleStatus(u)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                              u.isActive ? "bg-emerald-500" : "bg-stone-300"
                            }`}
                            title={isCurrentAdmin ? "Tidak dapat menonaktifkan akun sendiri" : u.isActive ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                u.isActive ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className={`text-xs font-medium ${u.isActive ? "text-emerald-700" : "text-stone-500"}`}>
                            {u.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-[#78716c]">
                        {formatDateTimeId(u.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetStaff(u);
                              setNewPassword("");
                              setShowResetPassword(false);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E7E5E3] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#272727] hover:border-amber-400 hover:text-amber-700 transition"
                            title="Reset Password Staf"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                            Reset Sandi
                          </button>

                          {/* Edit Staf */}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="rounded-lg border border-[#E7E5E3] bg-white p-1.5 text-[#78716c] hover:border-[#272727] hover:text-[#272727] transition"
                            title="Edit Data Staf"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Deactivate Staf */}
                          {!isCurrentAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteStaff(u)}
                              className="rounded-lg border border-[#E7E5E3] bg-white p-1.5 text-[#78716c] hover:border-rose-400 hover:text-rose-600 transition"
                              title="Nonaktifkan Akun Staf"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Staf Baru */}
      {isAddOpen && (
        <ModalFrame title="Tambah Akun Staf / Kasir Baru" onClose={() => setIsAddOpen(false)}>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Nama Lengkap Staf <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                  No. WhatsApp / HP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="08123456789"
                  className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="kasir@warkopagam.id"
                  className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Peran Hak Akses (Role) <span className="text-rose-500">*</span>
              </label>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as any)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] bg-white px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              >
                <option value="CASHIER">Kasir (Akses Terminal Kasir & Transaksi POS)</option>
                <option value="ADMIN">Administrator (Akses Penuh Seluruh Pengaturan)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Password Awal <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showAddPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-lg border border-[#E7E5E3] px-3 py-2 pr-10 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#78716c]">
                Password akan di-hash menggunakan bcrypt secara aman sebelum disimpan ke database.
              </p>
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
                {submittingAdd ? "Menyimpan..." : "Buat Akun Staf"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* Modal Edit Staf */}
      {editStaff && (
        <ModalFrame title={`Edit Profil Staf: ${editStaff.name}`} onClose={() => setEditStaff(null)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Nama Lengkap Staf <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                  No. WhatsApp / HP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Peran Hak Akses (Role)
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="mt-1.5 w-full rounded-lg border border-[#E7E5E3] bg-white px-3 py-2 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
              >
                <option value="CASHIER">Kasir (Akses Terminal Kasir & Transaksi POS)</option>
                <option value="ADMIN">Administrator (Akses Penuh Seluruh Pengaturan)</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditStaff(null)}
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

      {/* Modal Reset Password Staf */}
      {resetStaff && (
        <ModalFrame title={`Reset Password: ${resetStaff.name}`} onClose={() => setResetStaff(null)}>
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
              <KeyRound className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                Masukkan password baru untuk staf <strong>{resetStaff.name}</strong>. Password lama akan diganti dan staf dapat langsung masuk menggunakan password baru ini.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#272727] uppercase tracking-wider">
                Password Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showResetPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-lg border border-[#E7E5E3] px-3 py-2 pr-10 text-sm text-[#272727] focus:border-[#F16F62] focus:outline-none focus:ring-1 focus:ring-[#F16F62]"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetStaff(null)}
                className="rounded-lg border border-[#E7E5E3] px-4 py-2 text-sm font-medium text-[#78716c] hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingReset}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {submittingReset ? "Memproses..." : "Reset Password Sekarang"}
              </button>
            </div>
          </form>
        </ModalFrame>
      )}

      {/* Modal Deaktivasi Staf */}
      {deleteStaff && (
        <ModalFrame title={`Nonaktifkan Akun: ${deleteStaff.name}`} onClose={() => setDeleteStaff(null)}>
          <div className="space-y-4">
            <p className="text-sm text-[#272727]">
              Apakah Anda yakin ingin menonaktifkan akun staf <strong>{deleteStaff.name}</strong> ({deleteStaff.phone})?
            </p>
            <p className="text-xs text-[#78716c] leading-relaxed">
              Setelah dinonaktifkan, staf ini tidak akan dapat masuk ke sistem POS kasir. Riwayat transaksi yang pernah diproses oleh staf ini tetap tersimpan aman di database laporan audit.
            </p>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setDeleteStaff(null)}
                className="rounded-lg border border-[#E7E5E3] px-4 py-2 text-sm font-medium text-[#78716c] hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submittingDelete}
                onClick={handleDeleteStaff}
                className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {submittingDelete ? "Memproses..." : "Ya, Nonaktifkan Akun"}
              </button>
            </div>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}