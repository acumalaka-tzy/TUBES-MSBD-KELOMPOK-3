"use client";

import React, { useState, useTransition } from "react";
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";

interface ChangePasswordFormProps {
  hasExistingPassword: boolean;
}

export function ChangePasswordForm({ hasExistingPassword }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (hasExistingPassword && !currentPassword) {
      setErrorMessage("Password lama wajib diisi.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password baru tidak cocok.");
      return;
    }

    startTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Gagal memperbarui password.");
      } else {
        setSuccessMessage(res.message || "Password berhasil diubah.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="animate-fade-scale-in flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs font-medium text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="animate-fade-scale-in flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{successMessage}</p>
        </div>
      )}

      {hasExistingPassword && (
        <div>
          <label
            htmlFor="current-password"
            className="mb-1.5 block text-xs font-semibold text-foreground"
          >
            Password Lama
          </label>
          <div className="relative">
            <input
              id="current-password"
              type={showCurrent ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              disabled={isPending}
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <button
              type="button"
              onClick={() => setShowCurrent((prev) => !prev)}
              aria-label={showCurrent ? "Sembunyikan password lama" : "Lihat password lama"}
              className="absolute right-3 top-2.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="account-new-password"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Password Baru
        </label>
        <div className="relative">
          <input
            id="account-new-password"
            type={showNew ? "text" : "password"}
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            disabled={isPending}
            className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
          <button
            type="button"
            onClick={() => setShowNew((prev) => !prev)}
            aria-label={showNew ? "Sembunyikan password baru" : "Lihat password baru"}
            className="absolute right-3 top-2.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showNew ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="account-confirm-password"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Konfirmasi Password Baru
        </label>
        <div className="relative">
          <input
            id="account-confirm-password"
            type={showConfirm ? "text" : "password"}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password baru Anda"
            disabled={isPending}
            className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
          <button
            type="button"
            onClick={() => setShowConfirm((prev) => !prev)}
            aria-label={showConfirm ? "Sembunyikan konfirmasi password" : "Lihat konfirmasi password"}
            className="absolute right-3 top-2.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md active:scale-[0.99] disabled:opacity-60"
      >
        {isPending ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <>
            <KeyRound className="h-4 w-4" aria-hidden />
            <span>Simpan Password Baru</span>
          </>
        )}
      </button>
    </form>
  );
}
