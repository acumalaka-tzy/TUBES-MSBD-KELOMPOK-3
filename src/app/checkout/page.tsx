"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { saveRecentOrder, useActiveTable } from "@/lib/active-table";
import { createOrder, getTablesList, getAvailableProducts } from "@/actions";
import { TableItem, AvailableProduct } from "@/actions/types";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { PaymentSelector } from "@/components/checkout/PaymentSelector";
import { CartSummary } from "@/components/checkout/CartSummary";
import { Sparkles, AlertCircle } from "lucide-react";

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
  const [serviceType, setServiceType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableNumber, setTableNumber] = useState(urlTable || "01");
  const [tables, setTables] = useState<TableItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS" | "VIRTUAL_ACCOUNT">("QRIS");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Ambil daftar meja dan produk aktif dari MySQL
    getTablesList().then((data) => {
      setTables(data);
      if (urlTable && data.some((t) => t.table_number === urlTable)) {
        setTableNumber(urlTable);
      }
    });

    getAvailableProducts().then((prods) => {
      setAvailableProducts(prods);
    });
  }, [urlTable]);

  const handleAddRealProduct = (product: AvailableProduct) => {
    const defaultOptions = product.option_groups?.flatMap((g) => {
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
        setErrorMessage(res.error || "Gagal membuat pesanan. Silakan coba lagi.");
        setIsSubmitting(false);
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
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Checkout &amp; Pembayaran Mandiri</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          Selesaikan Pesanan Anda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Warkop Agam Senayan • Pesanan diproses otomatis ke kasir &amp; dapur
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* KOLOM KIRI: FORM DATA PEMESAN & METODE PEMBAYARAN */}
        <div className="lg:col-span-7 space-y-6">
          <CustomerForm
            serviceType={serviceType}
            onServiceTypeChange={setServiceType}
            tableNumber={tableNumber}
            onTableNumberChange={setTableNumber}
            tables={tables}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerPhone={customerPhone}
            onCustomerPhoneChange={setCustomerPhone}
            notes={notes}
            onNotesChange={setNotes}
          />

          <PaymentSelector
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />
        </div>

        {/* KOLOM KANAN: RINGKASAN PESANAN (STICKY) & MENU ASLI MYSQL */}
        <div className="lg:col-span-5">
          <CartSummary
            items={items}
            itemCount={itemCount}
            subtotal={subtotal}
            taxAmount={taxAmount}
            totalAmount={totalAmount}
            isSubmitting={isSubmitting}
            availableProducts={availableProducts}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onAddProduct={handleAddRealProduct}
          />
        </div>
      </form>
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
