import Link from "next/link";
import { ShieldAlert, LogIn, Home } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export default async function UnauthorizedPage() {
  const session = await getSession();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-secondary-bg px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 text-center shadow-sm md:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error">
          <ShieldAlert className="h-8 w-8" aria-hidden />
        </div>

        <span className="inline-block rounded-full bg-error/10 px-3 py-1 font-mono text-xs font-bold text-error">
          403 Forbidden - RBAC Protected
        </span>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Akses Terbatas
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Halaman ini dilindungi oleh mekanisme keamanan Role-Based Access Control (RBAC). Akun Anda tidak memiliki hak akses yang diperlukan untuk membuka halaman ini.
        </p>

        {session && (
          <div className="my-5 rounded-xl border border-border bg-secondary-bg/80 p-3 text-xs">
            <span className="text-muted-foreground">Status Login: </span>
            <span className="font-bold text-foreground">{session.name}</span>
            <span className="mx-1.5 text-muted-foreground">•</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary">
              Role: {session.role}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            <Home className="h-4 w-4" aria-hidden />
            Kembali ke Beranda
          </Link>

          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-bold text-foreground transition-colors hover:bg-secondary-bg hover:text-primary"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Ganti Akun / Login Lain
          </Link>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          Jika Anda adalah staf operasional restoran yang membutuhkan hak akses, silakan hubungi Administrator.
        </p>
      </div>
    </div>
  );
}
