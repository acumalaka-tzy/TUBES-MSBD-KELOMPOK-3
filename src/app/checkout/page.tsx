"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { saveRecentOrder, useActiveTable } from "@/lib/active-table";
import { getCurrentUserAction } from "@/app/actions/auth";
import {
  createOrder,
  getTablesList,
  getAvailableProducts,
  type AvailableProductSummary,
} from "@/app/actions/checkout";
import {
  ShoppingBag,
  CreditCard,
  QrCode,
  Banknote,
  Utensils,
  Package,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  ArrowRight,
  Database,
  UserCheck,
  Zap,
} from "lucide-react";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedTable = useActiveTable();
  const urlTable = searchParams.get("table") ?? searchParams.get("meja") ?? storedTable;

  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    taxAmount,
    totalAmount,
    itemCount,
  } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; phone: string; email: string | null; role: string } | null>(null);
  const [serviceType, setServiceType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableNumber, setTableNumber] = useState(urlTable || "01");
  const [tables, setTables] = useState<{ id: string; table_number: string; name: string }[]>([]);
  const [availableProducts, setAvailableProducts] = useState<AvailableProductSummary[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS" | "VIRTUAL_ACCOUNT">("QRIS");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getTablesList().then((data) => {
      setTables(data);
      if (urlTable && data.some((t) => t.table_number === urlTable)) {
        setTableNumber(urlTable);
      }
    });

    getAvailableProducts().then((prods) => {
      setAvailableProducts(prods);
    });

    getCurrentUserAction().then((user) => {
      if (user) {
        setCurrentUser(user);
        setCustomerName((prev) => prev || user.name);
        setCustomerPhone((prev) => prev || user.phone);
      }
    });
  }, [urlTable]);

  const handleAddRealProduct = (product: AvailableProductSummary) => {
    const defaultOptions =
      product.option_groups?.flatMap((g) => {
        if (g.is_required && g.items?.length > 0) {
          return [
            {
              groupName: g.name,
              optionName: g.items[0].name,
              priceAdjustment: g.items[0].price_adjustment || 0,
            },
          ];
        }
        return [];
      }) || [];

    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.base_price,
      quantity: 1,
      options: defaultOptions,
      itemNotes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (items.length === 0) {
      setErrorMessage("Keranjang pesanan masih kosong. Silakan pilih menu di bawah.");
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage("Silakan masukkan nama pemesan.");
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage("Silakan masukkan nomor WhatsApp aktif.");
      return;
    }
    if (serviceType === "DINE_IN" && !tableNumber) {
      setErrorMessage("Silakan pilih nomor meja.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrder({
        customerName,
        customerPhone,
        serviceType,
        tableNumber: serviceType === "DINE_IN" ? tableNumber : undefined,
        paymentMethod,
        notes,
        userId: currentUser?.id || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          itemNotes: i.itemNotes,
          options: i.options,
        })),
      });

      if (result.success && result.orderNumber) {
        saveRecentOrder({
          orderNumber: result.orderNumber,
          trackingToken: result.trackingToken,
          totalAmount,
          serviceType,
          tableNumber: serviceType === "DINE_IN" ? tableNumber : undefined,
          createdAt: new Date().toISOString(),
        });
        clearCart();
        router.push(`/orders/${result.orderNumber}?token=${result.trackingToken}`);
      } else {
        setErrorMessage(result.error || "Gagal membuat pesanan.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pesanan."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          Checkout &amp; Pembayaran
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lengkapi data pemesan dan pilih metode pembayaran untuk memproses pesanan Anda.
        </p>
      </div>

      {/* Banner Deteksi Meja dari QR */}
      {urlTable && (
        <div className="mb-6 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm">
              {urlTable}
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                QR Code Meja Terdeteksi: Meja {urlTable}
              </p>
              <p className="text-xs text-muted-foreground">
                Pesanan Anda akan langsung diantar ke meja ini.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-primary text-white px-3 py-1 rounded-full">
            Dine In Meja {urlTable}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-semibold">Perhatian</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* KOLOM KIRI: FORMULIR LAYANAN & PEMBAYARAN */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Tipe Layanan */}
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-secondary-bg text-primary text-xs flex items-center justify-center font-bold">
                1
              </span>
              Tipe Layanan
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setServiceType("DINE_IN")}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                  serviceType === "DINE_IN"
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border text-foreground/70 hover:bg-secondary-bg"
                }`}
              >
                <Utensils className="w-4 h-4" />
                Dine In (Makan di Tempat)
              </button>

              <button
                type="button"
                onClick={() => setServiceType("TAKEAWAY")}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                  serviceType === "TAKEAWAY"
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border text-foreground/70 hover:bg-secondary-bg"
                }`}
              >
                <Package className="w-4 h-4" />
                Takeaway (Bungkus)
              </button>
            </div>

            {serviceType === "DINE_IN" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Nomor Meja
                </label>
                <select
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.table_number}>
                      {t.name} (Meja {t.table_number})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Identitas Pemesan */}
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-secondary-bg text-primary text-xs flex items-center justify-center font-bold">
                2
              </span>
              Informasi Pemesan
            </h2>

            {/* Banner Status Akun / Guest Checkout */}
            {currentUser ? (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground">
                        Masuk sebagai: {currentUser.name}
                      </p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {currentUser.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {currentUser.phone} • {currentUser.email || "Pesanan tersimpan di akun Anda"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerName("");
                    setCustomerPhone("");
                    setCurrentUser(null);
                  }}
                  className="text-[11px] font-bold text-muted-foreground hover:text-primary underline ml-2"
                >
                  Pesan Tamu Lain
                </button>
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-secondary-bg/80 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Guest Checkout Didukung
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Cukup isi nama &amp; No. WhatsApp tanpa wajib daftar akun.
                    </p>
                  </div>
                </div>
                <Link
                  href="/login?redirect=/checkout"
                  className="shrink-0 text-xs font-bold text-primary hover:underline ml-2"
                >
                  Punya Akun? Masuk
                </Link>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp / HP Aktif <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 08123456789"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Digunakan kasir untuk notifikasi dan pelacakan pesanan Anda.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Catatan Khusus untuk Dapur (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Sambal dipisah, jangan pakai bawang goreng..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-secondary-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Metode Pembayaran */}
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-secondary-bg text-primary text-xs flex items-center justify-center font-bold">
                3
              </span>
              Pilihan Pembayaran
            </h2>

            <div className="space-y-3">
              {/* QRIS */}
              <label
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === "QRIS"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:bg-secondary-bg"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="QRIS"
                  checked={paymentMethod === "QRIS"}
                  onChange={() => setPaymentMethod("QRIS")}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-primary" />
                      QRIS (GoPay, OVO, Dana, BCA, LinkAja)
                    </span>
                    <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      Otomatis
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Batas waktu pembayaran 15 menit dengan verifikasi sistem otomatis.
                  </p>
                </div>
              </label>

              {/* TUNAI */}
              <label
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === "CASH"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:bg-secondary-bg"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CASH"
                  checked={paymentMethod === "CASH"}
                  onChange={() => setPaymentMethod("CASH")}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-primary" />
                      Tunai (Bayar Langsung di Kasir)
                    </span>
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Kasir
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dapatkan nomor pesanan, lalu bayar di meja kasir sebelum pesanan diproses.
                  </p>
                </div>
              </label>

              {/* VIRTUAL ACCOUNT */}
              <label
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === "VIRTUAL_ACCOUNT"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:bg-secondary-bg"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="VIRTUAL_ACCOUNT"
                  checked={paymentMethod === "VIRTUAL_ACCOUNT"}
                  onChange={() => setPaymentMethod("VIRTUAL_ACCOUNT")}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Virtual Account / Transfer Bank
                    </span>
                    <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      BCA / Mandiri / BRI
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nomor VA diterbitkan secara otomatis setelah pesanan dibuat.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: RINGKASAN PESANAN (STICKY) & PILIHAN MENU ASLI DARI DATABASE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm sticky top-24">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                Keranjang Pesanan ({itemCount})
              </h2>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* List Item Keranjang */}
            <div className="divide-y divide-border max-h-64 overflow-y-auto my-3 pr-1">
              {items.length === 0 ? (
                <div className="py-6 text-center">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">Keranjang Anda Kosong</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pilih menu asli dari daftar database di bawah ini untuk menambahkan.
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground leading-snug truncate">
                        {item.name}
                      </p>

                      {/* Varian */}
                      {item.options && item.options.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.options.map((o) => o.optionName).join(", ")}
                        </p>
                      )}

                      {/* Catatan Item */}
                      {item.itemNotes && (
                        <p className="text-[11px] text-primary/80 italic mt-0.5">
                          &ldquo;{item.itemNotes}&rdquo;
                        </p>
                      )}

                      <p className="text-xs font-bold text-foreground mt-1">
                        Rp {item.subtotal.toLocaleString("id-ID")}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center border border-border rounded-lg bg-secondary-bg">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* DAFTAR MENU ASLI LANGSUNG DARI DATABASE MYSQL */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
                <Database className="w-3.5 h-3.5 text-primary" />
                <span>Pilih Menu Cepat dari Katalog MySQL:</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-secondary-bg hover:bg-border/60 transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Rp {p.base_price.toLocaleString("id-ID")} • Sisa: {p.available_qty} porsi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddRealProduct(p)}
                      className="px-2.5 py-1 bg-white hover:bg-primary hover:text-white border border-border text-foreground text-xs font-bold rounded-lg transition-all shadow-2xs shrink-0"
                    >
                      + Tambah
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Rincian Kalkulasi Harga */}
            {items.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border text-sm">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Subtotal Item</span>
                  <span className="font-mono font-medium">
                    Rp {subtotal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Pajak Restoran (PB1 10%)</span>
                  <span className="font-mono font-medium">
                    Rp {taxAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-foreground font-extrabold text-base pt-2 border-t border-border">
                  <span>Total Tagihan</span>
                  <span className="font-mono text-primary text-lg">
                    Rp {totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            )}

            {/* Tombol Buat Pesanan */}
            <div className="mt-5">
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted-foreground/30 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan ke MySQL...</span>
                  </>
                ) : (
                  <>
                    <span>Konfirmasi &amp; Simpan Pesanan</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-muted-foreground mt-2">
                Data pesanan akan disimpan langsung ke tabel <strong>orders</strong> MySQL Anda.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted-foreground font-semibold">Memuat halaman checkout...</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
