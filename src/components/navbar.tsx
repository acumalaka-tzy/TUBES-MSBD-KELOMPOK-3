"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { ShoppingBag, Coffee, UtensilsCrossed } from "lucide-react";

export function Navbar() {
  const { itemCount, subtotal } = useCart();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-sm">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-foreground tracking-tight block leading-tight">
              Warkop Agam
            </span>
            <span className="text-xs text-muted-foreground block">
              Ordering & POS System
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-3 md:gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <UtensilsCrossed className="w-4 h-4 hidden sm:inline" />
            Menu
          </Link>

          <Link
            href="/checkout"
            className="relative flex items-center gap-2 bg-secondary-bg hover:bg-border/60 text-foreground px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Keranjang</span>
            {itemCount > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
            {subtotal > 0 && (
              <span className="hidden md:inline font-mono text-xs text-muted-foreground border-l border-border pl-2">
                Rp {subtotal.toLocaleString("id-ID")}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

