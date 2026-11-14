"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Coffee, Lock, Mail, Phone, User, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { registerAction, googleAuthAction } from "@/app/actions/auth";

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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak cocok.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    startTransition(async () => {
      const res = await registerAction(null, formData);
      if (!res.success) {
        setErrorMessage(res.error || "Gagal mendaftarkan akun. Silakan coba lagi.");
      } else if (res.redirectTo) {
        window.location.href = res.redirectTo;
      }
    });
  };

  const handleGoogleAuth = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-secondary-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm md:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Coffee className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Daftar Akun Pelanggan
          </h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            Buat akun untuk riwayat pesanan permanen dan checkout lebih cepat
          </p>
        </div>

        {/* Error Alert */}
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
          <span>Daftar dengan Google</span>
        </button>

        {/* Pemisah atau */}
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-muted-foreground">atau daftar manual</span>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-foreground mb-1.5">
              Nama Lengkap <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Andi Saputra"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
              />
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
          </div>

          <div>
            <label htmlFor="reg-phone" className="block text-xs font-semibold text-foreground mb-1.5">
              Nomor WhatsApp Aktif <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="cth: 081234567890"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
              />
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-foreground mb-1.5">
              Email <span className="text-muted-foreground font-normal">(Opsional)</span>
            </label>
            <div className="relative">
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cth: andi@gmail.com"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
              />
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-foreground mb-1.5">
              Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
              />
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-foreground mb-1.5">
              Konfirmasi Password <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="reg-confirm-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
              />
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
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
                <span>Daftar Akun Sekarang</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Sudah memiliki akun?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ingin langsung pesan tanpa daftar?{" "}
            <Link href="/checkout" className="font-semibold text-primary hover:underline">
              Guest Checkout
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
