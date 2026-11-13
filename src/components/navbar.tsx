"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Coffee, Compass, Home, Menu, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/context/cart-context";
import { useActiveTable } from "@/lib/active-table";
import { cn, formatRupiah } from "@/lib/utils";

const links = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/menu", label: "Katalog Menu", icon: UtensilsCrossed },
  { href: "/lacak", label: "Lacak Pesanan", icon: Compass },
  { href: "/#info", label: "Info Restoran", icon: Coffee },
];

function NavbarContent() {
  const pathname = usePathname();
  const { itemCount, subtotal, totalAmount } = useCart();
  const table = useActiveTable();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const checkoutHref = table ? `/checkout?table=${encodeURIComponent(table)}` : "/checkout";
  const showStickyMobileCart =
    itemCount > 0 && pathname !== "/checkout" && !pathname.startsWith("/orders/");

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-white shadow-sm">
              <Coffee className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <span className="block text-lg font-bold leading-tight tracking-tight text-foreground">
                Warkop Agam
              </span>
              <span className="block text-xs text-muted-foreground">Ordering &amp; POS System</span>
            </div>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-secondary-bg hover:text-primary",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Buka keranjang, ${itemCount} item`}
              className="relative flex h-11 items-center gap-2 rounded-xl bg-secondary-bg px-3.5 py-2 text-sm font-semibold text-foreground transition-all hover:bg-border/60"
            >
              <ShoppingBag className="h-4 w-4 text-primary" aria-hidden />
              <span className="hidden sm:inline">Keranjang</span>
              {itemCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                  {itemCount}
                </span>
              )}
              {subtotal > 0 && (
                <span className="hidden border-l border-border pl-2 font-mono text-xs text-muted-foreground lg:inline">
                  {formatRupiah(subtotal)}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav aria-label="Navigasi mobile" className="border-t border-border bg-white px-4 py-3 md:hidden">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-secondary-bg"
                >
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  {l.label}
                </Link>
              );
            })}
            <Link
              href={checkoutHref}
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Halaman Checkout ({itemCount})
            </Link>
          </nav>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Sticky Bottom Cart Bar khusus Mobile sesuai PRD 5.4 */}
      {showStickyMobileCart && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 p-3 shadow-lg backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                {itemCount}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-muted-foreground">Total (+PB1 10%)</p>
                <p className="font-mono text-sm font-extrabold text-foreground">{formatRupiah(totalAmount)}</p>
              </div>
            </button>
            <Link
              href={checkoutHref}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-hover"
            >
              <span>Checkout</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-white shadow-sm">
            <Coffee className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <span className="block text-lg font-bold leading-tight tracking-tight text-foreground">
              Warkop Agam
            </span>
            <span className="block text-xs text-muted-foreground">Ordering &amp; POS System</span>
          </div>
        </Link>
      </div>
    </header>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={<NavbarFallback />}>
      <NavbarContent />
    </Suspense>
  );
}
