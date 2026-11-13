"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/cart-context";
import {
  Coffee,
  ShoppingBag,
  QrCode,
  Search,
  Sparkles,
  ArrowRight,
  Flame,
  UtensilsCrossed,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { addItem, loadSampleItems, itemCount } = useCart();
  const [trackNumber, setTrackNumber] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  const sampleMenus = [
    {
      productId: "prd-bangladesh-06",
      name: "Indomie Bangladesh Spesial",
      category: "Makanan Berat",
      unitPrice: 18000,
      description: "Mie nyemek racikan bumbu rempah rahasia Warkop Agam dengan telur setengah matang.",
      badge: "Best Seller",
      options: [
        { groupName: "Level Pedas", optionName: "Pedas Sedang", priceAdjustment: 0 },
        { groupName: "Tambahan Topping", optionName: "Tambah Telur Setengah Matang", priceAdjustment: 4000 },
      ],
    },
    {
      productId: "prd-sanger-01",
      name: "Kopi Sanger Espresso",
      category: "Kopi Khas",
      unitPrice: 14000,
      description: "Perpaduan kopi robusta saring kental dengan susu kental manis pas takaran.",
      badge: "Favorit",
      options: [
        { groupName: "Suhu Penyajian", optionName: "Dingin (Es)", priceAdjustment: 2000 },
        { groupName: "Tingkat Manis", optionName: "Manis Normal", priceAdjustment: 0 },
      ],
    },
    {
      productId: "prd-rotibakar-08",
      name: "Roti Bakar Cokelat Keju",
      category: "Camilan",
      unitPrice: 15000,
      description: "Roti panggang garing di luar dengan isian cokelat lumer dan keju parut melimpah.",
      badge: "Camilan",
      options: [],
    },
    {
      productId: "prd-badak-05",
      name: "Es Soda Susu Badak",
      category: "Minuman Segar",
      unitPrice: 15000,
      description: "Minuman legendaris Sarsaparilla Badak khas Sumatera Utara dipadu susu creamy.",
      badge: "Legendaris",
      options: [],
    },
  ];

  const handleQuickAdd = (menu: (typeof sampleMenus)[0]) => {
    addItem({
      productId: menu.productId,
      name: menu.name,
      unitPrice: menu.unitPrice,
      quantity: 1,
      options: menu.options,
    });
    setNotification(`Berhasil menambahkan 1x ${menu.name} ke keranjang!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackNumber.trim()) {
      router.push(`/orders/${trackNumber.trim()}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
      {/* Toast Notifikasi */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {notification}
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-white to-secondary-bg border border-primary/20 rounded-3xl p-8 md:p-12 relative overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">
            <Flame className="w-3.5 h-3.5" />
            Warkop Agam Online Ordering
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
            Nongkrong Santai, <span className="text-primary">Pesan Tanpa Antre.</span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Pesan langsung dari meja Anda via QR Code (Dine In) atau bawa pulang (Takeaway).
            Sistem terintegrasi secara real-time dengan dapur & kasir.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/checkout"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              Buka Halaman Checkout ({itemCount})
            </Link>

            <Link
              href="/checkout?table=04"
              className="inline-flex items-center gap-2 px-5 py-3.5 bg-white hover:bg-secondary-bg border border-border text-foreground text-sm font-bold rounded-2xl transition-all shadow-sm"
            >
              <QrCode className="w-4 h-4 text-primary" />
              Simulasi Scan QR Meja 04
            </Link>
          </div>
        </div>
      </section>

      {/* Form Lacak Pesanan Cepat */}
      <section className="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Sudah Pernah Memesan?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lacak status persiapan pesanan Anda secara langsung.
          </p>
        </div>

        <form onSubmit={handleTrackSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Nomor Order (cth: ORD-20261113-001)"
            value={trackNumber}
            onChange={(e) => setTrackNumber(e.target.value)}
            className="px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-xs font-mono w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-foreground hover:bg-foreground/90 text-white text-xs font-bold rounded-xl shrink-0 transition-colors flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            Lacak
          </button>
        </form>
      </section>

      {/* Preview Menu & Cepat Tambah ke Keranjang */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              Pilihan Menu Warkop Agam
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Klik "Tambah ke Keranjang" untuk langsung menguji alur checkout Anda.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSampleItems}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Isi 2 Menu Otomatis
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sampleMenus.map((menu) => (
            <div
              key={menu.productId}
              className="bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary-bg px-2.5 py-1 rounded-md">
                    {menu.category}
                  </span>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {menu.badge}
                  </span>
                </div>

                <h3 className="font-bold text-base text-foreground leading-snug">
                  {menu.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {menu.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Harga</span>
                  <span className="font-mono text-sm font-extrabold text-foreground">
                    Rp {menu.unitPrice.toLocaleString("id-ID")}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickAdd(menu)}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold rounded-xl transition-all"
                >
                  + Tambah
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
