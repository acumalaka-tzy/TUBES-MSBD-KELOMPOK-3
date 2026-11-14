"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Utensils,
  ShoppingBag,
  Banknote,
  QrCode,
  Printer,
  CheckCircle2,
  Coins,
  SlidersHorizontal,
  X,
  Coffee,
  AlertCircle,
  User,
  Phone,
} from "lucide-react";
import type {
  AdminCategory,
  AdminOptionGroup,
  AdminProduct,
  AdminSettings,
} from "@/lib/admin/types";
import type { CashierOrder, CashierTableInfo } from "@/lib/cashier/types";
import { createPosOrderAction } from "@/app/actions/cashier";

interface CashierPosTabProps {
  categories: AdminCategory[];
  products: AdminProduct[];
  tables: CashierTableInfo[];
  settings: AdminSettings;
  preselectedTableNumber: string | null;
  onClearPreselectedTable: () => void;
  onOrderCreated: (order: CashierOrder) => Promise<void>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

interface PosCartItemOption {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
}

interface PosCartItem {
  cartItemId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  itemNotes: string;
  options: PosCartItemOption[];
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function CashierPosTab({
  categories,
  products,
  tables,
  settings,
  preselectedTableNumber,
  onClearPreselectedTable,
  onOrderCreated,
  onNotify,
}: CashierPosTabProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [menuSearch, setMenuSearch] = useState<string>("");

  // State Keranjang POS
  const [serviceType, setServiceType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>(() => {
    if (preselectedTableNumber) return preselectedTableNumber;
    const firstAvail = tables.find((t) => t.isActive && t.status === "AVAILABLE");
    return firstAvail?.tableNumber || tables[0]?.tableNumber || "01";
  });
  const [customerName, setCustomerName] = useState<string>("Pelanggan Kasir");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [cart, setCart] = useState<PosCartItem[]>([]);

  // State Pembayaran Tunai & Kembalian
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [cashPaidInput, setCashPaidInput] = useState<string>("");
  const [customCashTouched, setCustomCashTouched] = useState<boolean>(false);

  // Modal Pilih Varian Produk POS
  const [customizingProduct, setCustomizingProduct] = useState<AdminProduct | null>(null);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({});
  const [modalItemNotes, setModalItemNotes] = useState<string>("");
  const [modalQty, setModalQty] = useState<number>(1);

  const [isPending, startTransition] = useTransition();

  // Jika user datang dari tab Status Meja ("Buat Pesanan di Meja Ini")
  useEffect(() => {
    if (preselectedTableNumber) {
      setServiceType("DINE_IN");
      setSelectedTableNumber(preselectedTableNumber);
      onClearPreselectedTable();
    }
  }, [preselectedTableNumber, onClearPreselectedTable]);

  // Hitung jumlah stok produk yang sudah masuk ke keranjang POS
  const getQtyInCartForProduct = (productId: string): number => {
    return cart
      .filter((c) => c.productId === productId)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  // Filter daftar produk katalog kiri
  const filteredProducts = products.filter((p) => {
    if (selectedCategoryId !== "ALL" && p.categoryId !== selectedCategoryId) {
      return false;
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // Hitung Subtotal, Pajak PB1, dan Total Tagihan
  const subtotal = cart.reduce((sum, item) => {
    const optDelta = item.options.reduce((s, o) => s + o.priceAdjustment, 0);
    return sum + (item.unitPrice + optDelta) * item.quantity;
  }, 0);

  const taxAmount = settings.taxEnabled
    ? Math.round(subtotal * (settings.taxPercentage / 100))
    : 0;
  const totalAmount = subtotal + taxAmount;

  // Nominal uang tunai diterima (default = Uang Pas jika kasir belum mengetik manual)
  const effectiveCashPaid = customCashTouched
    ? Math.max(0, Math.round(Number(cashPaidInput.replace(/\D/g, "")) || 0))
    : totalAmount;

  const changeAmount = effectiveCashPaid - totalAmount;
  const isCashSufficient = paymentMethod !== "CASH" || effectiveCashPaid >= totalAmount;

  // Buka modal opsi/varian atau langsung masukkan jika tidak punya opsi
  const handleSelectProduct = (product: AdminProduct, forceQuickAdd = false) => {
    const alreadyInCart = getQtyInCartForProduct(product.id);
    const remainingStock = product.availableQty - alreadyInCart;

    if (!product.isAvailable || remainingStock <= 0) {
      onNotify(`Stok "${product.name}" sudah habis atau seluruhnya ada di keranjang.`, "error");
      return;
    }

    if (product.optionGroups.length === 0 || forceQuickAdd) {
      // Ambil opsi wajib pertama bila forceQuickAdd
      const defaultOpts: PosCartItemOption[] = [];
      for (const grp of product.optionGroups) {
        const availItems = grp.items.filter((i) => i.isAvailable);
        if (grp.isRequired && availItems.length > 0) {
          defaultOpts.push({
            groupName: grp.name,
            optionName: availItems[0].name,
            priceAdjustment: availItems[0].priceAdjustment,
          });
        }
      }
      addItemToPosCart(product, 1, defaultOpts, "");
      return;
    }

    // Inisialisasi pilihan default untuk modal varian
    const initialMap: Record<string, string[]> = {};
    for (const grp of product.optionGroups) {
      const availItems = grp.items.filter((i) => i.isAvailable);
      if (grp.isRequired && availItems.length > 0) {
        initialMap[grp.id] = [availItems[0].id];
      } else {
        initialMap[grp.id] = [];
      }
    }
    setSelectedOptionsMap(initialMap);
    setModalItemNotes("");
    setModalQty(1);
    setCustomizingProduct(product);
  };

  const addItemToPosCart = (
    product: AdminProduct,
    qty: number,
    options: PosCartItemOption[],
    notes: string,
  ) => {
    const signature = JSON.stringify({
      productId: product.id,
      options: [...options].sort((a, b) => a.groupName.localeCompare(b.groupName)),
      notes: notes.trim(),
    });

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          JSON.stringify({
            productId: c.productId,
            options: [...c.options].sort((a, b) => a.groupName.localeCompare(b.groupName)),
            notes: c.itemNotes.trim(),
          }) === signature,
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + qty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          cartItemId: `pos-ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          name: product.name,
          unitPrice: product.basePrice,
          quantity: qty,
          maxStock: product.availableQty,
          itemNotes: notes.trim(),
          options,
        },
      ];
    });
  };

  const handleConfirmModalProduct = () => {
    if (!customizingProduct) return;

    // Validasi grup wajib
    for (const grp of customizingProduct.optionGroups) {
      const chosen = selectedOptionsMap[grp.id] || [];
      if (grp.isRequired && chosen.length === 0) {
        onNotify(`Pilih minimal 1 opsi untuk "${grp.name}".`, "error");
        return;
      }
    }

    const chosenOpts: PosCartItemOption[] = [];
    for (const grp of customizingProduct.optionGroups) {
      const chosenIds = selectedOptionsMap[grp.id] || [];
      for (const id of chosenIds) {
        const found = grp.items.find((i) => i.id === id);
        if (found) {
          chosenOpts.push({
            groupName: grp.name,
            optionName: found.name,
            priceAdjustment: found.priceAdjustment,
          });
        }
      }
    }

    addItemToPosCart(customizingProduct, modalQty, chosenOpts, modalItemNotes);
    setCustomizingProduct(null);
  };

  const toggleModalOption = (group: AdminOptionGroup, optionId: string) => {
    setSelectedOptionsMap((prev) => {
      const current = prev[group.id] || [];
      if (group.isMulti) {
        const exists = current.includes(optionId);
        return {
          ...prev,
          [group.id]: exists ? current.filter((id) => id !== optionId) : [...current, optionId],
        };
      }
      return {
        ...prev,
        [group.id]: [optionId],
      };
    });
  };

  const handleUpdateCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;

          // Cek total kuantitas produk yang sama di keranjang
          const otherSameProductQty = prev
            .filter((c) => c.productId === item.productId && c.cartItemId !== cartItemId)
            .reduce((s, c) => s + c.quantity, 0);

          if (nextQty + otherSameProductQty > item.maxStock) {
            onNotify(`Stok "${item.name}" maksimal ${item.maxStock} porsi.`, "error");
            return item;
          }

          return { ...item, quantity: nextQty };
        })
        .filter((x): x is PosCartItem => x !== null);
    });
  };

  const handleSubmitPosOrder = () => {
    if (cart.length === 0) {
      onNotify("Tambahkan minimal 1 menu ke keranjang POS terlebih dahulu.", "error");
      return;
    }
    if (serviceType === "DINE_IN" && !selectedTableNumber) {
      onNotify("Pilih nomor meja untuk pesanan Dine In.", "error");
      return;
    }
    if (paymentMethod === "CASH" && !isCashSufficient) {
      onNotify(
        `Nominal bayar tunai kurang ${formatRupiah(Math.abs(changeAmount))} dari total tagihan.`,
        "error",
      );
      return;
    }

    startTransition(async () => {
      const res = await createPosOrderAction({
        customerName: customerName.trim() || "Pelanggan Kasir",
        customerPhone: customerPhone.trim() || "-",
        serviceType,
        tableNumber: serviceType === "DINE_IN" ? selectedTableNumber : undefined,
        paymentMethod,
        amountPaid: paymentMethod === "CASH" ? effectiveCashPaid : 0,
        notes: orderNotes.trim() || undefined,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          itemNotes: item.itemNotes || undefined,
          options: item.options,
        })),
      });

      if (!res.success || !res.order) {
        onNotify(res.error || "Gagal menyimpan pesanan POS.", "error");
        return;
      }

      // Reset form keranjang POS
      setCart([]);
      setCustomCashTouched(false);
      setCashPaidInput("");
      setOrderNotes("");
      setCustomerName("Pelanggan Kasir");
      setCustomerPhone("");

      onNotify(res.message || `Pesanan POS ${res.order.orderNumber} berhasil dibuat!`, "success");
      await onOrderCreated(res.order);
    });
  };

  // Tombol nominal cepat sesuai spesifikasi
  const quickCashButtons = [
    { label: "Uang Pas", value: totalAmount },
    { label: "Rp 20.000", value: 20000 },
    { label: "Rp 50.000", value: 50000 },
    { label: "Rp 100.000", value: 100000 },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* =====================================================================
       * PANEL KIRI (7 KOLOM): KATALOG MENU POS
       * =================================================================== */}
      <div className="space-y-4 lg:col-span-7">
        {/* Filter Kategori & Pencarian Cepat Menu */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Cari menu kopi, mie bangladesh, camilan..."
              className="w-full rounded-xl border border-border bg-[#F4F7F6] py-2.5 pr-4 pl-10 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:bg-white"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                selectedCategoryId === "ALL"
                  ? "bg-[#0E2A2E] text-white shadow-2xs"
                  : "border border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
              }`}
            >
              Semua Menu ({products.length})
            </button>
            {categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    active
                      ? "bg-[#0E2A2E] text-white shadow-2xs"
                      : "border border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid Produk */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const inCartQty = getQtyInCartForProduct(product.id);
            const remainingStock = Math.max(0, product.availableQty - inCartQty);
            const isOut = !product.isAvailable || remainingStock <= 0;

            return (
              <div
                key={product.id}
                className={`group flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-2xs transition-all ${
                  isOut
                    ? "border-border/60 opacity-60"
                    : inCartQty > 0
                      ? "border-primary ring-1 ring-primary/20 hover:shadow-md"
                      : "border-border hover:border-primary/50 hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-[#F4F7F6] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {product.categoryName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                        isOut
                          ? "bg-red-500/15 text-red-700"
                          : remainingStock <= product.minThreshold
                            ? "bg-amber-500/15 text-amber-800"
                            : "bg-emerald-500/15 text-emerald-800"
                      }`}
                    >
                      {isOut ? "Habis" : `Stok: ${remainingStock}`}
                    </span>
                  </div>

                  <h4 className="mt-2 font-extrabold text-foreground group-hover:text-primary">
                    {product.name}
                  </h4>
                  <p className="mt-0.5 font-mono text-sm font-black text-[#0E2A2E]">
                    {formatRupiah(product.basePrice)}
                  </p>

                  {product.optionGroups.length > 0 && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      <SlidersHorizontal className="h-3 w-3 text-primary" />
                      <span>{product.optionGroups.length} grup varian tersedia</span>
                    </p>
                  )}
                </div>

                <div className="mt-3.5 flex items-center gap-1.5 pt-2">
                  <button
                    type="button"
                    disabled={isOut}
                    onClick={() => handleSelectProduct(product, false)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0E2A2E] px-3 py-2 text-xs font-extrabold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      {product.optionGroups.length > 0 ? "Pilih Varian" : "Tambah"}
                    </span>
                    {inCartQty > 0 && (
                      <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.2 font-mono text-[10px] text-white">
                        {inCartQty}
                      </span>
                    )}
                  </button>

                  {product.optionGroups.length > 0 && !isOut && (
                    <button
                      type="button"
                      onClick={() => handleSelectProduct(product, true)}
                      title="Tambah cepat dengan varian standar"
                      className="rounded-xl border border-border bg-[#F4F7F6] px-2.5 py-2 text-[11px] font-extrabold text-foreground transition hover:bg-primary/10 hover:text-primary"
                    >
                      +1 Cepat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
       * PANEL KANAN (5 KOLOM): KERANJANG POS & KALKULATOR PEMBAYARAN
       * =================================================================== */}
      <div className="lg:col-span-5">
        <div className="sticky top-20 flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          {/* Header Keranjang POS */}
          <div className="flex items-center justify-between bg-[#0E2A2E] px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold tracking-tight">
                  Keranjang Pesanan POS Kasir
                </h3>
                <p className="text-[11px] text-white/75">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item dipilih
                </p>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Kosongkan</span>
              </button>
            )}
          </div>

          <div className="space-y-4 p-5">
            {/* 1. Pilihan Dine In vs Takeaway */}
            <div>
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Tipe Layanan Pesanan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServiceType("DINE_IN")}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-extrabold transition ${
                    serviceType === "DINE_IN"
                      ? "border-[#0E2A2E] bg-[#0E2A2E] text-white shadow-xs"
                      : "border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
                  }`}
                >
                  <Utensils className="h-4 w-4" />
                  <span>Dine In (Meja)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServiceType("TAKEAWAY")}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-extrabold transition ${
                    serviceType === "TAKEAWAY"
                      ? "border-[#0E2A2E] bg-[#0E2A2E] text-white shadow-xs"
                      : "border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Takeaway (Bungkus)</span>
                </button>
              </div>
            </div>

            {/* Pemilih Nomor Meja jika Dine In */}
            {serviceType === "DINE_IN" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Pilih Meja Pelanggan
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700">
                    Hijau = Kosong • Kuning = Terisi
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {tables
                    .filter((t) => t.isActive)
                    .map((tbl) => {
                      const isSelected = selectedTableNumber === tbl.tableNumber;
                      const isOccupied = tbl.status === "OCCUPIED";
                      return (
                        <button
                          key={tbl.id}
                          type="button"
                          onClick={() => setSelectedTableNumber(tbl.tableNumber)}
                          className={`flex flex-col items-center justify-center rounded-xl border py-2 text-center transition ${
                            isSelected
                              ? "border-primary bg-primary text-white shadow-xs"
                              : isOccupied
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20"
                          }`}
                        >
                          <span className="font-mono text-xs font-black">
                            {tbl.tableNumber}
                          </span>
                          <span className="text-[9px] font-bold opacity-85">
                            {isOccupied ? "Terisi" : `${tbl.capacity}k`}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 2. Data Pelanggan */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Nama Pelanggan
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Pelanggan Kasir"
                    className="w-full rounded-xl border border-border bg-[#F4F7F6] py-2 pr-3 pl-8 text-xs font-bold text-foreground outline-none focus:border-primary focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  No. WhatsApp (Opsional)
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full rounded-xl border border-border bg-[#F4F7F6] py-2 pr-3 pl-8 text-xs font-bold text-foreground outline-none focus:border-primary focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 3. Daftar Item Keranjang POS */}
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-border bg-[#F4F7F6] p-2.5">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Klik menu di sebelah kiri untuk menambahkan pesanan ke keranjang POS.
                </div>
              ) : (
                cart.map((item) => {
                  const optDelta = item.options.reduce((s, o) => s + o.priceAdjustment, 0);
                  const lineTotal = (item.unitPrice + optDelta) * item.quantity;

                  return (
                    <div
                      key={item.cartItemId}
                      className="rounded-xl border border-border bg-white p-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-foreground">{item.name}</p>
                          <p className="font-mono text-[11px] font-bold text-muted-foreground">
                            {formatRupiah(item.unitPrice + optDelta)} / porsi
                          </p>
                        </div>
                        <span className="font-mono text-xs font-black text-[#0E2A2E]">
                          {formatRupiah(lineTotal)}
                        </span>
                      </div>

                      {item.options.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.options.map((opt, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-[#F4F7F6] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                            >
                              {opt.optionName}
                              {opt.priceAdjustment > 0
                                ? ` (+${formatRupiah(opt.priceAdjustment)})`
                                : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.itemNotes && (
                        <p className="mt-1 text-[10px] font-semibold italic text-amber-800">
                          Catatan: {item.itemNotes}
                        </p>
                      )}

                      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2">
                        <input
                          type="text"
                          value={item.itemNotes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCart((prev) =>
                              prev.map((c) =>
                                c.cartItemId === item.cartItemId ? { ...c, itemNotes: val } : c,
                              ),
                            );
                          }}
                          placeholder="+ Catatan item..."
                          className="w-36 rounded-lg border border-transparent bg-[#F4F7F6] px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary focus:bg-white"
                        />

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.cartItemId, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-border bg-white text-foreground hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-6 text-center font-mono text-xs font-black">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.cartItemId, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0E2A2E] text-white hover:bg-primary"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 4. Metode Pembayaran & Kalkulator Tunai / Kembalian */}
            <div className="space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-extrabold transition ${
                    paymentMethod === "CASH"
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                      : "border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Tunai (Cash)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("QRIS")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-extrabold transition ${
                    paymentMethod === "QRIS"
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-2xs"
                      : "border-border bg-[#F4F7F6] text-foreground hover:bg-muted"
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  <span>QRIS Digital</span>
                </button>
              </div>

              {/* Kalkulator Nominal Tunai & Kembalian Otomatis */}
              {paymentMethod === "CASH" && totalAmount > 0 && (
                <div className="space-y-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950">
                      Input Bayar Tunai Cepat
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">
                      Kalkulasi Kembalian Otomatis
                    </span>
                  </div>

                  {/* Tombol Cepat: Uang Pas, Rp20.000, Rp50.000, Rp100.000 */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {quickCashButtons.map((btn) => {
                      const active = effectiveCashPaid === btn.value;
                      return (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            setCustomCashTouched(true);
                            setCashPaidInput(String(btn.value));
                          }}
                          className={`rounded-lg border px-2 py-1.5 text-[11px] font-extrabold transition ${
                            active
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-emerald-600/30 bg-white text-emerald-950 hover:bg-emerald-500/15"
                          }`}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3 font-mono text-xs font-extrabold text-muted-foreground">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        effectiveCashPaid > 0
                          ? effectiveCashPaid.toLocaleString("id-ID")
                          : ""
                      }
                      onChange={(e) => {
                        setCustomCashTouched(true);
                        const raw = e.target.value.replace(/\D/g, "");
                        setCashPaidInput(raw || "0");
                      }}
                      placeholder="Nominal uang tunai diterima..."
                      className="w-full rounded-xl border border-border bg-white py-2 pr-3 pl-9 font-mono text-sm font-black text-foreground outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-muted-foreground">
                      <Coins className="h-4 w-4 text-emerald-600" />
                      <span>Kembalian:</span>
                    </span>
                    <span
                      className={`font-mono text-base font-black ${
                        isCashSufficient ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {isCashSufficient
                        ? formatRupiah(changeAmount)
                        : `Kurang ${formatRupiah(Math.abs(changeAmount))}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Rincian Subtotal, Pajak & Total */}
              <div className="rounded-xl bg-[#F4F7F6] p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Pajak PB1 ({settings.taxPercentage}%)</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatRupiah(taxAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-black text-[#0E2A2E]">
                  <span>TOTAL TAGIHAN</span>
                  <span className="font-mono text-lg">{formatRupiah(totalAmount)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending || cart.length === 0 || !isCashSufficient}
                onClick={handleSubmitPosOrder}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                <span>
                  {isPending
                    ? "Memproses Transaksi POS..."
                    : paymentMethod === "CASH"
                      ? "Proses Lunas & Cetak Struk"
                      : "Buat Pesanan QRIS & Cetak Struk"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
       * MODAL PILIH VARIAN / TOPPING PRODUK POS
       * =================================================================== */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#0E2A2E] px-5 py-4 text-white">
              <div>
                <h4 className="text-sm font-extrabold">{customizingProduct.name}</h4>
                <p className="font-mono text-xs text-emerald-400">
                  Harga Dasar: {formatRupiah(customizingProduct.basePrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="rounded-xl bg-white/10 p-1.5 text-white/80 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {customizingProduct.optionGroups.map((group) => {
                const selectedIds = selectedOptionsMap[group.id] || [];
                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-foreground">
                        {group.name}
                      </span>
                      <span className="rounded-md bg-[#F4F7F6] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {group.isRequired ? "Wajib" : "Opsional"} •{" "}
                        {group.isMulti ? "Bisa lebih dari 1" : "Pilih 1"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.items
                        .filter((it) => it.isAvailable)
                        .map((opt) => {
                          const isChosen = selectedIds.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleModalOption(group, opt.id)}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                                isChosen
                                  ? "border-primary bg-primary/10 font-extrabold text-primary"
                                  : "border-border bg-white font-semibold text-foreground hover:bg-muted"
                              }`}
                            >
                              <span>{opt.name}</span>
                              {opt.priceAdjustment > 0 && (
                                <span className="font-mono text-[11px]">
                                  +{formatRupiah(opt.priceAdjustment)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="mb-1 block text-xs font-extrabold text-foreground">
                  Catatan Khusus Item (Opsional)
                </label>
                <input
                  type="text"
                  value={modalItemNotes}
                  onChange={(e) => setModalItemNotes(e.target.value)}
                  placeholder="Contoh: Kurangi es, kuah pisah..."
                  className="w-full rounded-xl border border-border bg-[#F4F7F6] px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border bg-[#F4F7F6] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white font-bold"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-8 text-center font-mono text-sm font-black">
                  {modalQty}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setModalQty((q) =>
                      Math.min(
                        customizingProduct.availableQty -
                          getQtyInCartForProduct(customizingProduct.id),
                        q + 1,
                      ),
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0E2A2E] text-white font-bold"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmModalProduct}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-primary-hover"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Masukkan ke Keranjang POS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
