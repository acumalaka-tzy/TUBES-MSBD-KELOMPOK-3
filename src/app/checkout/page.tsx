"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, CartItem } from "@/context/cart-context";
import { saveRecentOrder, useActiveTable } from "@/lib/active-table";
import { createOrder, getTablesList, getCatalogProducts } from "@/actions";
import { TableItem } from "@/actions/types";
import { Product } from "@/lib/menu-data";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { PaymentSelector } from "@/components/checkout/PaymentSelector";
import { CartSummary } from "@/components/checkout/CartSummary";
import { ProductDetail } from "@/components/product-detail";
import { getCurrentUserAction } from "@/app/actions/auth";
import { Sparkles, AlertCircle, X } from "lucide-react";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedTable = useActiveTable();
  const urlTable = searchParams.get("table") ?? searchParams.get("meja") ?? storedTable;
  const urlService = searchParams.get("service");

  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    taxAmount,
    totalAmount,
    itemCount,
    serviceType,
    setServiceType,
    orderNotes: notes,
    setOrderNotes: setNotes,
    taxLabel,
    storeSettings,
    refreshStoreSettings,
  } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
  } | null>(null);

  const [tableNumber, setTableNumber] = useState(urlTable || "01");
  const [tables, setTables] = useState<TableItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [editingTarget, setEditingTarget] = useState<{ product: Product; cartItemId: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MIDTRANS">("MIDTRANS");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshStoreSettings();
  }, [refreshStoreSettings]);

  useEffect(() => {
    if (urlTable) {
      setServiceType("DINE_IN");
    } else if (urlService === "TAKEAWAY" || urlService === "DINE_IN") {
      setServiceType(urlService);
    }
  }, [urlTable, urlService, setServiceType]);

  useEffect(() => {
    // Ambil daftar meja dan produk katalog dari MySQL
    getTablesList().then((data) => {
      setTables(data);
      if (urlTable && data.some((t) => t.table_number === urlTable)) {
        setTableNumber(urlTable);
      }
    });

    getCatalogProducts().then((prods) => {
      setCatalogProducts(prods);
    });

    getCurrentUserAction().then((user) => {
      if (user) {
        setCurrentUser(user);
        setCustomerName((prev) => prev || user.name);
        setCustomerPhone((prev) => prev || user.phone);
      }
    });
  }, [urlTable]);

  const handleEditItem = (item: CartItem) => {
    const prod = catalogProducts.find((p) => p.id === item.productId);
    if (prod) {
      setEditingTarget({ product: prod, cartItemId: item.id });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!storeSettings.isWebOrderingOpen) {
      setErrorMessage("Maaf, pemesanan melalui web sedang ditutup sementara oleh admin.");
      return;
    }

    if (items.length === 0) {
      setErrorMessage("Keranjang pesanan masih kosong. Silakan pilih menu di bawah.");
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage("Silakan masukkan nama pemesan.");
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage("Silakan masukkan nomor WhatsApp untuk pembaruan status pesanan.");
      return;
    }
    if (serviceType === "DINE_IN" && !tableNumber) {
      setErrorMessage("Silakan pilih nomor meja Anda.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createOrder({
        customerName,
        customerPhone,
        serviceType,
        tableNumber: serviceType === "DINE_IN" ? tableNumber : undefined,
        paymentMethod,
        notes,
        userId: currentUser?.id || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          itemNotes: it.itemNotes,
          options: it.options.map((opt) => ({
            groupName: opt.groupName,
            optionName: opt.optionName,
            priceAdjustment: opt.priceAdjustment,
          })),
        })),
      });

      if (!res.success || !res.orderNumber) {
        const errText = res.error || "Gagal membuat pesanan. Silakan coba lagi.";
        setErrorMessage(errText);
        setIsSubmitting(false);

        // Jika error terkait meja, scroll otomatis ke pemilih meja agar fokus
        if (/meja/i.test(errText)) {
          setTimeout(() => {
            const tableEl = document.getElementById("table-number-select");
            tableEl?.scrollIntoView({ behavior: "smooth", block: "center" });
            tableEl?.focus();
          }, 100);
        }
        return;
      }

      // Simpan riwayat pesanan ke localStorage via active-table
      saveRecentOrder({
        orderNumber: res.orderNumber,
        trackingToken: res.trackingToken,
        totalAmount,
        serviceType,
        tableNumber: serviceType === "DINE_IN" ? tableNumber : undefined,
        createdAt: new Date().toISOString(),
      });

      clearCart();
      router.push(`/orders/${res.orderNumber}${res.trackingToken ? `?token=${res.trackingToken}` : ""}`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pesanan."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Halaman */}
      <div
        style={{ animationDelay: "0ms" }}
        className="animate-fade-slide-up mb-8"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Checkout &amp; Pembayaran Mandiri</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          Selesaikan Pesanan Anda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Warkop Agam Medan • Pesanan diproses otomatis ke kasir &amp; dapur
        </p>
      </div>

      {!storeSettings.isWebOrderingOpen && (
        <div className="animate-fade-scale-in mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Pemesanan web sedang ditutup sementara oleh admin.</strong> Silakan hubungi kasir atau coba beberapa saat lagi.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="animate-fade-scale-in mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* KOLOM KIRI: FORM DATA PEMESAN & METODE PEMBAYARAN */}
        <div
          style={{ animationDelay: "80ms" }}
          className="animate-fade-slide-up lg:col-span-7 space-y-6"
        >
          <CustomerForm
            serviceType={serviceType}
            onServiceTypeChange={setServiceType}
            tableNumber={tableNumber}
            onTableNumberChange={(t) => {
              setTableNumber(t);
              if (errorMessage && /meja/i.test(errorMessage)) setErrorMessage(null);
            }}
            tableError={errorMessage && /meja/i.test(errorMessage) ? errorMessage : null}
            tables={tables}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerPhone={customerPhone}
            onCustomerPhoneChange={setCustomerPhone}
            notes={notes}
            onNotesChange={setNotes}
            currentUser={currentUser}
            onClearCurrentUser={() => {
              setCurrentUser(null);
              setCustomerName("");
              setCustomerPhone("");
            }}
          />

          <PaymentSelector
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />
        </div>

        {/* KOLOM KANAN: RINGKASAN PESANAN (STICKY) */}
        <div
          style={{ animationDelay: "150ms" }}
          className="animate-fade-slide-up lg:col-span-5"
        >
          <CartSummary
            items={items}
            itemCount={itemCount}
            subtotal={subtotal}
            totalAmount={totalAmount}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onClearErrorMessage={() => setErrorMessage(null)}
            isWebOrderingOpen={storeSettings.isWebOrderingOpen}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onEditItem={handleEditItem}
          />
        </div>
      </form>

      {/* Floating Bottom Alert Toast agar Selalu Terlihat di Layar Kapanpun Muncul */}
      {errorMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-4 rounded-2xl bg-destructive text-white shadow-2xl border border-white/20 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-white" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider text-white/90">
                Peringatan Pemesanan
              </p>
              <p className="text-xs font-semibold text-white leading-relaxed mt-0.5">
                {errorMessage}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors shrink-0"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal Edit Varian Pesanan dari Ringkasan */}
      {editingTarget && (
        <ProductDetail
          product={editingTarget.product}
          initialCartItemId={editingTarget.cartItemId}
          onClose={() => setEditingTarget(null)}
        />
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-muted-foreground text-sm">
          Memuat halaman checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
