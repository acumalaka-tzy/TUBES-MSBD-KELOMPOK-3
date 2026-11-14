"use client";

import React, { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Coffee, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { loginAction, quickDemoLoginAction } from "@/app/actions/auth";
import type { UserRole } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        router.push(res.redirectTo);
        router.refresh();
      }
    });
  };

  const handleQuickDemo = (role: UserRole) => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await quickDemoLoginAction(role);
      if (!res.success) {
        setErrorMessage(res.error || "Gagal login demo.");
      } else if (res.redirectTo) {
        const dest = redirectTarget || res.redirectTo;
        router.push(dest);
        router.refresh();
      }
    });
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
          Akses akun Admin, Kasir, atau Pelanggan Terdaftar
        </p>
      </div>

      {/* Demo Credentials Helper Pill untuk Pengujian MSBD */}
      <div className="mb-6 rounded-xl border border-border/80 bg-secondary-bg/80 p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          <span>Quick Login Demo (Pengujian Role MSBD):</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleQuickDemo("ADMIN")}
            className="flex items-center justify-center rounded-lg border border-border bg-white py-1.5 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
            title="Login instan sebagai Admin"
          >
            Admin
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleQuickDemo("CASHIER")}
            className="flex items-center justify-center rounded-lg border border-border bg-white py-1.5 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
            title="Login instan sebagai Kasir"
          >
            Kasir
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleQuickDemo("CUSTOMER")}
            className="flex items-center justify-center rounded-lg border border-border bg-white py-1.5 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
            title="Login instan sebagai Customer"
          >
            Pelanggan
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground text-center">
          Klik tombol di atas untuk login otomatis role demo sesuai seed.
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs font-medium text-error">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      )}

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
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@warkopagam.id / 081260001001"
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
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
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
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60"
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
          Hanya ingin memesan cepat? Anda dapat langsung melakukan{" "}
          <Link href="/checkout" className="font-semibold text-primary hover:underline">
            Guest Checkout
          </Link>{" "}
          tanpa mendaftar akun.
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
