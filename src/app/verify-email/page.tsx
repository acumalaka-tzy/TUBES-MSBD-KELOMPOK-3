"use client";

import React, { useState, useEffect, useRef, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RotateCw, ArrowLeft } from "lucide-react";
import { verifyOtpAction, resendOtpAction } from "@/app/actions/auth";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email] = useState(emailParam);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cooldown kirim ulang (60 detik)
  const [cooldown, setCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus pada input pertama saat mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    // Hanya perbolehkan angka
    const cleanValue = value.replace(/\D/g, "");

    if (!cleanValue) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    // Jika user paste lebih dari 1 digit
    if (cleanValue.length > 1) {
      const digits = cleanValue.slice(0, 6).split("");
      const newOtp = [...otp];
      for (let i = 0; i < digits.length; i++) {
        if (index + i < 6) {
          newOtp[index + i] = digits[i];
        }
      }
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    // Auto-focus ke input berikutnya
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasteData) return;

    const newOtp = [...otp];
    const digits = pasteData.split("");
    for (let i = 0; i < 6; i++) {
      newOtp[i] = digits[i] || "";
    }
    setOtp(newOtp);

    const focusIdx = Math.min(pasteData.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const code = otp.join("");
    if (code.length !== 6) {
      setErrorMessage("Silakan lengkapi 6 digit kode OTP.");
      return;
    }

    if (!email) {
      setErrorMessage("Alamat email tidak ditemukan. Silakan daftar ulang.");
      return;
    }

    startTransition(async () => {
      const res = await verifyOtpAction(email, code);
      if (!res.success) {
        setErrorMessage(res.error || "Verifikasi gagal.");
      } else {
        setSuccessMessage("Verifikasi berhasil! Mengalihkan ke halaman utama...");
        setTimeout(() => {
          window.location.href = res.redirectTo || "/";
        }, 800);
      }
    });
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending || !email) return;

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await resendOtpAction(email);
      if (res.success) {
        setSuccessMessage(res.message || "Kode OTP baru telah dikirimkan ke email Anda.");
        setCooldown(60);
      } else {
        setErrorMessage(res.error || "Gagal mengirim ulang kode OTP.");
      }
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan saat mengirim ulang kode.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm md:p-8">
      {/* Icon & Title */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mail className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Verifikasi Email Anda
        </h1>
        <p className="mt-2 text-xs text-muted-foreground md:text-sm">
          Kami telah mengirimkan 6 digit kode verifikasi ke alamat email:
        </p>
        <p className="mt-1 font-semibold text-foreground text-sm bg-secondary-bg py-1 px-3 rounded-lg inline-block border border-border">
          {email || "Email Anda"}
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs font-medium text-error">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 p-3 text-xs font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>{successMessage}</p>
        </div>
      )}

      {/* OTP Inputs Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-center text-xs font-semibold text-muted-foreground mb-3">
            Masukkan 6 Digit Kode OTP
          </label>
          <div className="flex justify-center gap-2 sm:gap-2.5">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isPending}
                className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border-2 border-border text-center text-xl font-bold text-foreground transition-all focus:border-primary focus:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            ⏰ Kode OTP aktif selama 15 menit. Cek juga folder Spam/Junk jika belum masuk.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={isPending || otp.join("").length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span>Verifikasi &amp; Aktifkan Akun</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </form>

      {/* Resend Cooldown Section */}
      <div className="mt-6 border-t border-border pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Tidak menerima kode verifikasi?
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
        >
          {isResending ? (
            <>
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
              <span>Mengirim ulang...</span>
            </>
          ) : cooldown > 0 ? (
            <span>Kirim ulang kode ({cooldown} detik)</span>
          ) : (
            <>
              <RotateCw className="h-3.5 w-3.5" />
              <span>Kirim Ulang Kode Sekarang</span>
            </>
          )}
        </button>
      </div>

      {/* Back to Register link */}
      <div className="mt-4 text-center">
        <Link
          href="/register"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Ganti nomor WhatsApp atau email</span>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-secondary-bg px-4 py-10">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-border">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}

