"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Coffee } from "lucide-react";
import { triggerScrollToSectionAcrossPages } from "@/lib/smooth-scroll";

function FooterContent() {
  const pathname = usePathname();
  const router = useRouter();

  // Jangan render footer konsumen di dashboard admin maupun POS kasir
  if (pathname.startsWith("/admin") || pathname.startsWith("/cashier")) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-border bg-background pb-20 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <Coffee className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span>Warkop Agam — Padang Bulan, Medan</span>
        </div>
        <nav aria-label="Navigasi footer" className="flex flex-wrap gap-x-5 gap-y-2.5 font-semibold">
          <Link href="/" className="hover:text-primary">Beranda</Link>
          <Link href="/menu" className="hover:text-primary">Katalog Menu</Link>
          <Link href="/checkout" className="hover:text-primary">Checkout</Link>
          <Link href="/lacak" className="hover:text-primary">Lacak Pesanan</Link>
          <Link
            href="/#info"
            onClick={(e) => {
              e.preventDefault();
              triggerScrollToSectionAcrossPages("info", () => router.push("/"), -72, 680);
            }}
            className="hover:text-primary"
          >
            Info Restoran
          </Link>
        </nav>
        <p>© Warkop Agam • Tugas Besar MSBD Kelompok 3</p>
      </div>
    </footer>
  );
}

export function Footer() {
  return (
    <Suspense fallback={null}>
      <FooterContent />
    </Suspense>
  );
}
