"use client";

import React, { useRef, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Coffee, Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { loginAction, googleAuthAction } from "@/app/actions/auth";

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "";
  const urlError = searchParams.get("error");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(urlError || null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("identifier", identifier);
    formData.append("password", password);
    if (redirectTarget) {
      formData.append("redirect", redirectTarget);
    }

    startTransition(async () => {
      const res = await loginAction(null, formData);
      if (!res.success) {
        setErrorMessage(res.error || "Gagal masuk. Periksa kembali email/nomor WhatsApp dan password Anda.");
      } else if (res.redirectTo) {
        // Hard navigation agar cookie auth sesi langsung terbaca penuh oleh Server Component & Middleware
        window.location.href = res.redirectTo;
      }
    });
  };

  const handleGoogleAuth = () => {
    const target = redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : "";
    window.location.href = `/api/auth/google${target}`;
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm md:p-8">
      {/* Header Form */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Coffee className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Masuk ke Warkop Agam
        </h1>
        <p className="mt-1 text-xs text-muted-foreground md:text-sm">
          Gunakan email atau nomor WhatsApp terdaftar Anda
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs font-medium text-error">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Tombol Google Auth */}
      <button
        type="button"
        disabled={isPending}
        onClick={handleGoogleAuth}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white text-xs font-bold text-foreground transition-all hover:bg-secondary-bg hover:border-border/80 active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-2xs mb-5"
      >
        <GoogleIcon className="h-4 w-4" />
        <span>Masuk dengan Google</span>
      </button>

      {/* Pemisah atau */}
      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-muted-foreground">atau masuk manual</span>
        </div>
      </div>

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-semibold text-foreground mb-1.5"
          >
            Email atau Nomor WhatsApp
          </label>
          <div className="relative">
            <input
              id="identifier"
              type="text"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Contoh: admin@warkopagam.id / 081260001001"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={isPending}
            />
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-foreground"
            >
              Password
            </label>
          </div>
          <div className="relative">
            <input
              ref={passwordInputRef}
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password Anda"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={isPending}
            />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 cursor-pointer"
        >
          {isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span>Masuk Sekarang</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </form>

      {/* Footer Info & Links */}
      <div className="mt-6 border-t border-border pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Belum punya akun pelanggan?{" "}
          <Link
            href="/register"
            className="font-bold text-primary hover:underline"
          >
            Daftar di sini
          </Link>
        </p>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Hanya ingin memesan makanan? Anda dapat langsung melakukan{" "}
          <Link href="/checkout" className="font-semibold text-primary hover:underline">
            Guest Checkout
          </Link>{" "}
          tanpa wajib mendaftar.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-secondary-bg px-4 py-10">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-xs text-muted-foreground">Memuat halaman login...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
