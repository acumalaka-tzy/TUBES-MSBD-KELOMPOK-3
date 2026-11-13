import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 font-bold">
        <ShoppingBag className="w-6 h-6" />
      </div>
      <h1 className="text-2xl font-black text-foreground tracking-tight">
        Warkop Agam — Halaman Utama
      </h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        (Halaman ini adalah area pengerjaan anggota tim untuk Katalog Menu & Homepage).
      </p>

      <div className="mt-8">
        <Link
          href="/checkout"
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all"
        >
          <span>Buka Fitur Checkout & Pembayaran</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
