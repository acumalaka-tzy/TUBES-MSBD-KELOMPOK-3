import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShieldCheck,
  UtensilsCrossed,
  QrCode,
  DollarSign,
  LogOut,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";

export default async function AdminDashboardPage() {
  const session = await getSession();

  // Proteksi ganda di Server Component (Defense in Depth)
  if (!session) {
    redirect("/login?redirect=/admin");
  }
  if (session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-secondary-bg/50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Admin Header Card */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-8 w-8" aria-hidden />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                  ADMINISTRATOR
                </span>
                <span className="text-xs text-muted-foreground">Server-Side RBAC Active</span>
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                Panel Manajemen — {session.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                Email: {session.email || "-"} • WhatsApp: {session.phone}
              </p>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-bold text-error transition-colors hover:bg-error/10 hover:border-error/30"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span>Keluar (Logout)</span>
            </button>
          </form>
        </div>

        {/* Security & RBAC Verification Status Box */}
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 text-xs text-foreground">
          <div className="flex items-center gap-2 font-bold text-success mb-1">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            <span>Keamanan Sesi &amp; Hak Akses Database (RBAC) Terverifikasi</span>
          </div>
          <p className="text-muted-foreground">
            Halaman ini diproteksi oleh <strong>Server-Side Proxy / Middleware Next.js</strong> dan diverifikasi menggunakan token <strong>JWT HTTP-Only</strong>. Hanya pengguna dengan role <code>ADMIN</code> yang diizinkan mengakses area ini.
          </p>
        </div>

        {/* Overview Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Hak Akses Role</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Full Access</p>
            <p className="mt-1 text-[11px] text-muted-foreground">DCL/TCL &amp; Master Data</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Dashboard Kasir</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">POS Ready</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Antrean Pesanan &amp; Kasir</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Meja &amp; QR Meja</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <QrCode className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Tervalidasi</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Token Kriptografi Meja</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Metode Bayar</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Tunai &amp; Digital</p>
            <p className="mt-1 text-[11px] text-muted-foreground">QRIS, VA, Bayar Kasir</p>
          </div>
        </div>

        {/* Quick Nav Actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/cashier"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary">
                Buka Layar POS Kasir
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Sebagai Admin, Anda juga memiliki hak akses untuk memantau antrean pesanan dan pembayaran di POS Kasir.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
              <span>Buka Kasir</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/menu"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary">
                Katalog Menu Pelanggan
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Lihat tampilan menu makanan, minuman, dan snack sebagaimana dilihat oleh pelanggan di website.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
              <span>Lihat Katalog</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/lacak"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary">
                Lacak Status Pesanan
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pantau pesanan pelanggan melalui nomor pesanan struk atau token pelacakan unik.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
              <span>Lacak Pesanan</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
