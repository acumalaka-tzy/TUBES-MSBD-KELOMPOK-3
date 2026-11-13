import Link from "next/link";
import { Coffee } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-secondary-bg pb-20 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
            <Coffee className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span>Warkop Agam — Ordering &amp; POS System</span>
        </div>
        <nav className="flex flex-wrap gap-4 font-semibold">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <Link href="/menu" className="hover:text-primary">Katalog Menu</Link>
          <Link href="/checkout" className="hover:text-primary">Checkout</Link>
          <Link href="/lacak" className="hover:text-primary">Lacak Pesanan</Link>
          <Link href="/#info" className="hover:text-primary">Info Restoran</Link>
        </nav>
        <p>© Warkop Agam • Tugas Besar MSBD Kelompok 3</p>
      </div>
    </footer>
  );
}
