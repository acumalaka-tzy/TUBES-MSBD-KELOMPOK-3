import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { getDefaultRedirectForRole, getSession, getUserRecordById } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

async function AccountSettingsContent() {
  const session = await getSession();
  if (!session) {
    redirect("/login?redirect=/account");
  }

  const userRecord = await getUserRecordById(session.sub);
  const backHref = getDefaultRedirectForRole(session.role);
  const backLabel =
    session.role === "ADMIN"
      ? "Kembali ke Panel Admin"
      : session.role === "CASHIER"
        ? "Kembali ke POS Kasir"
        : "Kembali ke Beranda";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-secondary-bg px-4 py-8 sm:py-10">
      <div className="animate-fade-scale-in mx-auto w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs transition-colors hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            <span>{backLabel}</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>{session.role}</span>
          </span>
        </div>

        {/* Ringkasan Profil Akun */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-foreground sm:text-lg">
                Pengaturan Akun
              </h1>
              <p className="truncate text-xs text-muted-foreground">{session.name}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-xl bg-secondary-bg/70 px-3 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Email</p>
                <p className="truncate text-xs font-bold text-foreground">
                  {session.email || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-secondary-bg/70 px-3 py-2.5">
              <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">WhatsApp</p>
                <p className="truncate text-xs font-bold text-foreground">
                  {session.phone || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Ubah Password */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6 md:p-7">
          <div className="mb-4">
            <h2 className="text-base font-bold text-foreground">Ubah Password</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Perbarui password akun Anda secara berkala untuk menjaga keamanan akses.
            </p>
          </div>
          <ChangePasswordForm hasExistingPassword={Boolean(userRecord?.password_hash)} />
        </div>
      </div>
    </div>
  );
}

function AccountFallback() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-secondary-bg px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-lg space-y-5 animate-pulse">
        <div className="h-10 w-32 rounded-xl bg-white/70" />
        <div className="h-44 rounded-2xl bg-white/70" />
        <div className="h-64 rounded-2xl bg-white/70" />
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<AccountFallback />}>
      <AccountSettingsContent />
    </Suspense>
  );
}
