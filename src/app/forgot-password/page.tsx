"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { requestPasswordResetAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await requestPasswordResetAction(email);
      if (!res.success) {
        setErrorMessage(res.error || "Gagal memproses permintaan reset password.");
      } else {
        setSuccessMessage(
          res.message ||
            "Jika email tersebut terdaftar di sistem Warkop Agam, tautan untuk mengatur ulang password telah dikirimkan ke kotak masuk Anda."
        );
      }
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-secondary-bg px-4 py-10">
      <div className="animate-fade-scale-in w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6 md:p-8">
        <div style={{ animationDelay: "40ms" }} className="animate-fade-slide-up mb-6 text-center">
          <div className="mb-3.5 flex justify-center">
            <BrandLogo variant="dark-pill" size="lg" priority />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Lupa Password
          </h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            Masukkan email akun terdaftar Anda untuk menerima tautan pemulihan password
          </p>
        </div>

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
          <div style={{ animationDelay: "120ms" }} className="animate-fade-slide-up">
            <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold text-foreground">
              Alamat Email Terdaftar
            </label>
            <div className="relative">
              <input
                id="reset-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domain.com"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 text-sm text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
              />
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            style={{ animationDelay: "180ms" }}
            className="animate-fade-slide-up mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md active:scale-[0.99] disabled:opacity-60"
          >
            {isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Kirim Tautan Reset</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </form>

        <div
          style={{ animationDelay: "240ms" }}
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
    </div>
  );
}
