import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  UtensilsCrossed,
  Clock,
  Receipt,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
  PlusCircle,
  DollarSign,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";

async function CashierDashboardContent() {
  const session = await getSession();

  // Defense in depth server-side check
  if (!session) {
    redirect("/login?redirect=/cashier");
  }
  if (session.role !== "CASHIER" && session.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-secondary-bg/50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cashier Header Card */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UtensilsCrossed className="h-8 w-8" aria-hidden />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                  {session.role === "ADMIN" ? "ADMIN (POS MODE)" : "KASIR OPERASIONAL"}
                </span>
                <span className="text-xs text-muted-foreground">Shift Kasir Aktif</span>
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                Point of Sales (POS) — {session.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                ID Staf: {session.sub} • WhatsApp: {session.phone}
              </p>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-bold text-error transition-colors hover:bg-error/10 hover:border-error/30"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span>Keluar Shift (Logout)</span>
            </button>
          </form>
        </div>

        {/* Security & RBAC Status Banner */}
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 text-xs text-foreground">
          <div className="flex items-center gap-2 font-bold text-success mb-1">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            <span>Server-Side Middleware / Proxy RBAC Aktif</span>
          </div>
          <p className="text-muted-foreground">
            Halaman ini diproteksi pada tingkat server. Hanya pengguna dengan role <code>CASHIER</code> atau <code>ADMIN</code> yang dapat mengakses antrean dan POS kasir ini.
          </p>
        </div>

        {/* Cashier Quick Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Antrean Pesanan Web</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Live Queue</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Pesanan Masuk dari Meja &amp; Web</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Konfirmasi Tunai</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Kasir Pay</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Pembayaran Tunai di Kasir</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Cetak Struk</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Thermal 58/80</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Cetak Struk Pembayaran</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Ketersediaan Stok</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">Tersinkron</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Reservasi Stok Otomatis</p>
          </div>
        </div>

        {/* Quick Nav Actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/checkout"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PlusCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary">
                Buat Pesanan Pelanggan (POS)
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Input pesanan manual untuk pelanggan yang memesan langsung di kasir (Dine In meja atau Takeaway).
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
              <span>Buka Form Pemesanan</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/lacak"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary">
                Cari &amp; Lacak Pesanan
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cari pesanan berdasarkan nomor struk (ORD-...) untuk memeriksa status pembayaran dan pesanan.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
              <span>Lacak Pesanan</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/menu"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground group-hover:text-primary">
                Cek Ketersediaan Menu
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Lihat daftar harga menu makanan &amp; minuman terkini serta status stok habis/tersedia.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
              <span>Lihat Menu</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CashierDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-secondary-bg/50 px-4 py-16 text-center text-xs font-semibold text-muted-foreground">
          Memuat layar POS kasir...
        </div>
      }
    >
      <CashierDashboardContent />
    </Suspense>
  );
}
