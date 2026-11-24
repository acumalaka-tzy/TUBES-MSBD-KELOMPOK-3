"use client";

import React, { useEffect, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  resetPasswordWithTokenAction,
  validateResetTokenAction,
} from "@/app/actions/auth";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    validateResetTokenAction(token).then((res) => {
      if (!active) return;
      setTokenValid(res.valid);
      if (!res.valid) {
        setTokenError(res.error || "Tautan reset password tidak valid atau sudah kedaluwarsa.");
      }
      setCheckingToken(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password baru tidak cocok.");
      return;
    }

    startTransition(async () => {
      const res = await resetPasswordWithTokenAction({
        token,
        newPassword,
        confirmPassword,
      });
      if (!res.success) {
        setErrorMessage(res.error || "Gagal mengatur ulang password.");
      } else {
        setSuccessMessage(res.message || "Password berhasil diatur ulang.");
        setTimeout(() => {
          router.push("/login");
        }, 1600);
      }
    });
  };

  return (
    <div className="animate-fade-scale-in w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6 md:p-8">
      <div style={{ animationDelay: "40ms" }} className="animate-fade-slide-up mb-6 text-center">
        <div className="mb-3.5 flex justify-center">
          <BrandLogo variant="dark-pill" size="lg" priority />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Atur Ulang Password
        </h1>
        <p className="mt-1 text-xs text-muted-foreground md:text-sm">
          Buat password baru yang kuat untuk keamanan akun Anda
        </p>
      </div>

      {checkingToken ? (
        <div className="py-8 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-xs text-muted-foreground">Memverifikasi tautan pemulihan...</p>
        </div>
      ) : !tokenValid ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3.5 text-xs font-medium text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{tokenError || "Tautan reset password tidak valid atau sudah kedaluwarsa."}</p>
          </div>
          <Link
            href="/forgot-password"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-hover"
          >
            <span>Ajukan Tautan Reset Baru</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          {errorMessage && (
            <div className="animate-fade-scale-in mb-5 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs font-medium text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="animate-fade-scale-in mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div style={{ animationDelay: "110ms" }} className="animate-fade-slide-up">
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-foreground">
                Password Baru
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  disabled={isPending || Boolean(successMessage)}
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

            <div style={{ animationDelay: "160ms" }} className="animate-fade-slide-up">
              <label
                htmlFor="confirm-new-password"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  disabled={isPending || Boolean(successMessage)}
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
              disabled={isPending || Boolean(successMessage)}
              style={{ animationDelay: "210ms" }}
              className="animate-fade-slide-up mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md active:scale-[0.99] disabled:opacity-60"
            >
              {isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Simpan Password Baru</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </form>
        </>
      )}

      <div
        style={{ animationDelay: "260ms" }}
        className="animate-fade-slide-up mt-6 border-t border-border pt-4 text-center"
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <span>Kembali ke Halaman Masuk</span>
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-secondary-bg px-4 py-10">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-xs text-muted-foreground">Memuat halaman reset password...</p>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
