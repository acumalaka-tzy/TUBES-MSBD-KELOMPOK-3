"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import {
  ArrowRight,
  Coffee,
  Compass,
  Home,
  Menu,
  ShoppingBag,
  UtensilsCrossed,
  X,
  User,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/context/cart-context";
import { useActiveTable } from "@/lib/active-table";
import { cn, formatRupiah } from "@/lib/utils";
import { getCurrentUserAction, logoutAction } from "@/app/actions/auth";

const links = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/menu", label: "Katalog Menu", icon: UtensilsCrossed },
  { href: "/lacak", label: "Lacak Pesanan", icon: Compass },
  { href: "/#info", label: "Info Restoran", icon: Coffee },
];

function NavbarContent() {
  const pathname = usePathname();
  const { items, itemCount, subtotal, totalAmount, isCartOpen, openCart, closeCart, storeSettings } = useCart();
  const table = useActiveTable();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
  } | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      setCurrentUser(u);
    });
  }, [pathname]);

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
            {/* Tombol Keranjang */}
            <button
              type="button"
              onClick={openCart}
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

            {/* Tombol Akun / Login Desktop (Hanya Logo Profil) */}
            {currentUser ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((v) => !v)}
                  title={`Profil: ${currentUser.name} (${currentUser.role})`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-foreground transition-all hover:border-primary/50 hover:bg-secondary-bg/50 cursor-pointer shadow-2xs"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                </button>

                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setUserDropdownOpen(false)}
                  >
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-xs font-bold text-foreground">{currentUser.name}</p>
                      <p className="text-[10px] font-mono text-primary font-semibold">{currentUser.role}</p>
                    </div>

                    {currentUser.role === "ADMIN" && (
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary-bg"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        <span>Panel Admin</span>
                      </Link>
                    )}

                    {(currentUser.role === "CASHIER" || currentUser.role === "ADMIN") && (
                      <Link
                        href="/cashier"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary-bg"
                      >
                        <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                        <span>POS Kasir</span>
                      </Link>
                    )}

                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-error hover:bg-error/10 text-left"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex h-11 items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-bold text-foreground transition-all hover:border-primary hover:text-primary"
              >
                <LogIn className="h-4 w-4" />
                <span>Masuk</span>
              </Link>
            )}

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

            {/* Bagian Akun di Mobile Menu */}
            <div className="mt-3 border-t border-border pt-3">
              {currentUser ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-secondary-bg p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{currentUser.name}</p>
                        <p className="text-[10px] text-muted-foreground">{currentUser.phone}</p>
                      </div>
                    </div>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold font-mono text-primary">
                      {currentUser.role}
                    </span>
                  </div>

                  {currentUser.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-xs font-bold text-primary hover:bg-secondary-bg"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Panel Administrator
                    </Link>
                  )}

                  {(currentUser.role === "CASHIER" || currentUser.role === "ADMIN") && (
                    <Link
                      href="/cashier"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-xs font-bold text-primary hover:bg-secondary-bg"
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                      POS Kasir
                    </Link>
                  )}

                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-bold text-error hover:bg-error/10 text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Keluar (Logout)
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-white text-xs font-bold text-foreground hover:border-primary hover:text-primary"
                  >
                    <LogIn className="h-4 w-4" />
                    Masuk
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover"
                  >
                    Daftar Akun
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <CartDrawer open={isCartOpen} onClose={closeCart} />

      {/* Sticky Bottom Cart Bar khusus Mobile sesuai PRD 5.4 */}
      {showStickyMobileCart && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 p-3 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={openCart}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-secondary-bg"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-mono text-sm font-black text-primary">
                {itemCount}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-muted-foreground">
                  {items.length} menu dipilih • Ketuk rincian
                </p>
                <p className="font-mono text-sm font-extrabold text-foreground">
                  {formatRupiah(totalAmount)}{" "}
                  <span className="font-sans text-[10px] font-normal text-muted-foreground">
                    {storeSettings.taxEnabled ? `(+PB1 ${storeSettings.taxPercentage}%)` : "(Tanpa Pajak)"}
                  </span>
                </p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openCart}
                className="inline-flex h-11 items-center rounded-xl border border-border bg-secondary-bg px-3 text-xs font-bold text-foreground hover:bg-border/60"
              >
                Keranjang
              </button>
              <Link
                href={checkoutHref}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-white shadow-sm hover:bg-primary-hover"
              >
                <span>Checkout</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
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
