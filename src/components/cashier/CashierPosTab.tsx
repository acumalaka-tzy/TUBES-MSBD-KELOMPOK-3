"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
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
  Flame,
  Check,
  ChevronDown,
} from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { getStockStatus } from "@/lib/menu-data";
import { useScrollLock } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";
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

function formatRupiah(amount: number | null | undefined): string {
  const val = typeof amount === "number" && !Number.isNaN(amount) && Number.isFinite(amount) ? amount : 0;
  return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
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
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MIDTRANS">("CASH");
  const [cashPaidInput, setCashPaidInput] = useState<string>("");
  const [customCashTouched, setCustomCashTouched] = useState<boolean>(false);

  // Modal Pilih Varian Produk POS
  const [customizingProduct, setCustomizingProduct] = useState<AdminProduct | null>(null);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({});
  const [modalItemNotes, setModalItemNotes] = useState<string>("");
  const [modalQty, setModalQty] = useState<number>(1);

  useScrollLock(Boolean(customizingProduct));

  const [isPending, startTransition] = useTransition();

  // Hitung penyesuaian harga varian pada modal
  const modalOptionsAdjustment = useMemo(() => {
    if (!customizingProduct) return 0;
    let total = 0;
    for (const grp of customizingProduct.optionGroups) {
      const chosenIds = selectedOptionsMap[grp.id] || [];
      for (const id of chosenIds) {
        const found = grp.items.find((i) => i.id === id);
        if (found) {
          total += Number(found.priceAdjustment || 0);
        }
      }
    }
    return total;
  }, [customizingProduct, selectedOptionsMap]);

  const modalUnitPrice = (customizingProduct?.basePrice || 0) + modalOptionsAdjustment;
  const modalTotalPrice = modalUnitPrice * modalQty;

  const missingRequiredInModal = useMemo(() => {
    if (!customizingProduct) return false;
    return customizingProduct.optionGroups.some((g) => {
      if (!g.isRequired) return false;
      const chosen = selectedOptionsMap[g.id] || [];
      return chosen.length === 0;
    });
  }, [customizingProduct, selectedOptionsMap]);

  // Rekomendasi catatan cepat khas F&B Warkop
  const quickNotes = useMemo(() => {
    if (!customizingProduct) return [];
    const text = `${customizingProduct.name} ${customizingProduct.categoryName}`.toLowerCase();
    if (/kopi|sanger|teh|minum|dingin|jeruk|milo|badak/.test(text)) {
      return [
        "Gula dikurangi",
        "Es batu sedikit",
        "Gula dipisah",
        "Kopi lebih kental",
        "Disajikan hangat",
      ];
    }
    if (/mie|indomie|nasi|aceh|makanan/.test(text)) {
      return [
        "Kuah dipisah",
        "Tanpa bawang goreng",
        "Telur matang sempurna",
        "Acar & cabai pisah",
        "Bumbu lebih lekoh",
      ];
    }
    return [
      "Potong kecil-kecil",
      "Susu/selai dipisah",
      "Panggang lebih garing",
      "Sajikan hangat",
    ];
  }, [customizingProduct]);

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

  const taxAmount = 0;
  const totalAmount = subtotal;

  // Nominal uang tunai diterima (default = Uang Pas jika kasir belum mengetik manual)
  const effectiveCashPaid = customCashTouched
    ? Math.max(0, Math.round(Number(cashPaidInput.replace(/\D/g, "")) || 0))
    : totalAmount;

  const changeAmount = effectiveCashPaid - totalAmount;
  const isCashSufficient = paymentMethod !== "CASH" || effectiveCashPaid >= totalAmount;

  // Buka modal opsi/varian (selaras dengan tampilan detail menu customer)
  const handleSelectProduct = (product: AdminProduct, forceQuickAdd = false) => {
    const alreadyInCart = getQtyInCartForProduct(product.id);
    const remainingStock = product.availableQty - alreadyInCart;

    if (!product.isAvailable || remainingStock <= 0) {
      onNotify(`Stok "${product.name}" sudah habis atau seluruhnya ada di keranjang.`, "error");
      return;
    }

    if (forceQuickAdd) {
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
    if (serviceType === "DINE_IN") {
      if (!selectedTableNumber) {
        onNotify("Pilih nomor meja untuk pesanan Dine In.", "error");
        return;
      }
      const targetTbl = tables.find((t) => t.tableNumber === selectedTableNumber);
      if (targetTbl && (!targetTbl.isActive || targetTbl.status === "INACTIVE")) {
        const cleanTable = String(selectedTableNumber).replace(/^0+/, "") || selectedTableNumber;
        onNotify(`Meja ${cleanTable} sedang nonaktif dan tidak dapat digunakan.`, "error");
        return;
      }
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

          <div className="mt-3 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
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
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
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

        {/* Grid Produk POS (Sesuai Gaya Kartu Menu Customer) */}
        <div className="grid grid-cols-1 gap-3.5 min-[440px]:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const inCartQty = getQtyInCartForProduct(product.id);
            const remainingStock = Math.max(0, product.availableQty - inCartQty);
            const status = getStockStatus(remainingStock, product.minThreshold);
            const isOut = !product.isAvailable || remainingStock <= 0;

            return (
              <article
                key={product.id}
                onClick={() => {
                  if (!isOut) handleSelectProduct(product, false);
                }}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xs transition-all cursor-pointer",
                  !isOut && "hover:border-primary/50 hover:shadow-md",
                  isOut && "border-border/60 opacity-60 cursor-not-allowed",
                  inCartQty > 0 && "ring-2 ring-primary/40 border-primary"
                )}
              >
                {/* Gambar Produk */}
                <div className="relative border-b border-border/50">
                  <ProductImage
                    product={{
                      id: product.id,
                      name: product.name,
                      emoji: "☕",
                      imageUrl: product.imageUrl || undefined,
                    }}
                    sizes="(min-width: 1280px) 24vw, (min-width: 440px) 45vw, 95vw"
                    className={cn(
                      "aspect-[4/3] transition-transform duration-300",
                      !isOut && "group-hover:scale-[1.02]",
                      isOut && "grayscale"
                    )}
                  />

                  {/* Indikator Badge Jumlah di Keranjang POS */}
                  {inCartQty > 0 && (
                    <span
                      title={`${inCartQty} item ada di keranjang POS`}
                      className="absolute right-2.5 top-2.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-black text-white shadow-md ring-2 ring-white animate-in zoom-in-75 duration-200"
                    >
                      {inCartQty}
                    </span>
                  )}
                </div>

                <div className={cn("flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5", isOut && "opacity-75")}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
                      {product.categoryName}
                    </span>
                    <StockBadge status={status} />
                  </div>

                  <h4 className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {product.name}
                  </h4>

                  <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-relaxed text-muted-foreground">
                    {product.description || `${product.categoryName} khas Warkop Agam`}
                  </p>

                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
                    <div>
                      <span className="font-mono text-xs sm:text-sm font-extrabold text-foreground">
                        {formatRupiah(product.basePrice)}
                      </span>
                      {!isOut ? (
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          Sisa: {remainingStock} porsi
                        </span>
                      ) : (
                        <span className="block font-mono text-[10px] text-error font-semibold">
                          Stok: 0 porsi
                        </span>
                      )}
                    </div>

                    {isOut ? (
                      <span className="rounded-lg bg-error/10 px-2.5 py-1 text-xs font-bold text-error">
                        Habis
                      </span>
                    ) : inCartQty > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(product, false);
                        }}
                        aria-label={`${inCartQty} ${product.name} di keranjang POS`}
                        className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary px-3 text-xs font-black text-white shadow-2xs transition-colors hover:bg-primary-hover"
                      >
                        <span>{inCartQty}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(product, false);
                        }}
                        aria-label={`Pilih ${product.name}`}
                        className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-primary-hover"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        <span>Tambah</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
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
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
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

            {/* Pilihan Meja jika Dine In (Format Dropdown Sesuai Sisi Customer) */}
            {serviceType === "DINE_IN" && (
              <div className="space-y-2 rounded-2xl border border-border bg-[#F4F7F6]/80 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label
                    htmlFor="pos-table-number-select"
                    className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Pilih Nomor Meja <span className="text-red-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Tersedia {tables.filter((t) => t.isActive).length} meja
                  </span>
                </div>

                <div className="relative">
                  <Utensils className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-primary" />
                  <select
                    id="pos-table-number-select"
                    value={selectedTableNumber}
                    onChange={(e) => {
                      const targetTbl = tables.find((t) => t.tableNumber === e.target.value);
                      if (targetTbl && (!targetTbl.isActive || targetTbl.status === "INACTIVE")) {
                        const cleanNum = String(targetTbl.tableNumber).replace(/^0+/, "") || targetTbl.tableNumber;
                        onNotify(`Meja ${cleanNum} sedang nonaktif dan tidak dapat dipilih.`, "error");
                        return;
                      }
                      setSelectedTableNumber(e.target.value);
                    }}
                    className="w-full appearance-none rounded-xl border border-border bg-white py-2.5 pl-10 pr-10 text-xs font-bold text-foreground shadow-2xs transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="">-- Pilih Nomor Meja Pelanggan --</option>
                    {tables
                      .filter((t) => t.isActive)
                      .map((tbl) => {
                        const isBlocked = !tbl.isActive || tbl.status === "INACTIVE";
                        const num = String(tbl.tableNumber).replace(/^0+/, "") || String(tbl.tableNumber);
                        return (
                          <option key={tbl.id} value={tbl.tableNumber} disabled={isBlocked}>
                            Meja {num}
                          </option>
                        );
                      })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                </div>

                {selectedTableNumber && (
                  <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>
                      Pesanan akan disajikan ke{" "}
                      <strong className="font-extrabold text-foreground">
                        Meja {String(selectedTableNumber).replace(/^0+/, "") || String(selectedTableNumber)}
                      </strong>.
                    </span>
                  </div>
                )}
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

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
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
                          className="min-w-0 flex-1 rounded-lg border border-transparent bg-[#F4F7F6] px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary focus:bg-white sm:w-36 sm:flex-none"
                        />

                        <div className="flex shrink-0 items-center gap-1.5">
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

            {/* 4. Metode Pembayaran: Kasir Khusus Tunai (Cash) */}
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between rounded-xl border border-emerald-600/30 bg-emerald-500/10 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                    <Banknote className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-foreground">Pembayaran Kasir: Tunai (Cash)</p>
                    <p className="text-[11px] text-muted-foreground">Non-tunai hanya melalui aplikasi pelanggan</p>
                  </div>
                </div>
                <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                  Tunai
                </span>
              </div>

              {/* Kalkulator Nominal Tunai & Kembalian Otomatis */}
              {totalAmount > 0 && (
                <div className="space-y-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950">
                      Input Bayar Tunai Cepat
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">
                      Kalkulasi Kembalian Otomatis
                    </span>
                  </div>

                  {/* Tombol Cepat: Uang Pas, Rp20.000, Rp50.000, Rp100.000 */}
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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

              {/* Rincian Total */}
              <div className="rounded-xl bg-[#F4F7F6] p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-sm font-black text-[#0E2A2E]">
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
                  {isPending ? "Memproses Transaksi POS..." : "Proses Lunas & Cetak Struk"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
       * MODAL PILIH VARIAN / TOPPING PRODUK POS (GAYA CUSTOMER PRODUCT-DETAIL)
       * =================================================================== */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none md:items-center md:p-6">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setCustomizingProduct(null)}
            className="touch-none absolute inset-0 bg-white/25 backdrop-blur-md transition-opacity duration-300"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-product-detail-title"
            className="animate-fade-scale-in relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-h-[88dvh] md:max-w-xl md:rounded-3xl"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden />

            {/* Tombol Tutup Floating X */}
            <button
              type="button"
              onClick={() => setCustomizingProduct(null)}
              aria-label="Tutup detail"
              className="absolute right-3.5 top-3.5 z-20 flex size-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white text-foreground transition-all"
            >
              <X className="size-4" aria-hidden />
            </button>

            {/* Kontainer Form Varian Scrollable */}
            <div className="overflow-y-auto overscroll-contain no-scrollbar flex-1">
              <ProductImage
                product={{
                  id: customizingProduct.id,
                  name: customizingProduct.name,
                  imageUrl: customizingProduct.imageUrl || undefined,
                  emoji: "🍽️",
                }}
                className="aspect-[16/10]"
                emojiClassName="text-8xl"
                sizes="(min-width: 768px) 512px, 100vw"
              />

              <div className="space-y-5 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {customizingProduct.categoryName}
                    </span>
                    <StockBadge
                      status={getStockStatus(
                        customizingProduct.availableQty,
                        customizingProduct.minThreshold,
                      )}
                    />
                  </div>
                  <h2 id="pos-product-detail-title" className="mt-1 text-xl font-bold text-foreground">
                    {customizingProduct.name}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {customizingProduct.description || `${customizingProduct.categoryName} khas Warkop Agam`}
                  </p>
                  <p className="mt-2 text-lg font-bold text-primary">
                    {formatRupiah(customizingProduct.basePrice)}
                  </p>
                </div>

                {customizingProduct.optionGroups.map((group) => {
                  const selectedIds = selectedOptionsMap[group.id] || [];
                  return (
                    <fieldset key={group.id} className="space-y-2 border-t border-border pt-4">
                      <div className="flex items-baseline justify-between">
                        <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {group.name}
                        </legend>
                        <span className="text-[11px] text-muted-foreground">
                          {group.isRequired ? "Wajib dipilih" : "Opsional"} •{" "}
                          {group.isMulti ? "Bisa lebih dari 1" : "Pilih 1"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.items
                          .filter((it) => it.isAvailable)
                          .map((opt) => {
                            const isChosen = selectedIds.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={cn(
                                  "flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm transition-colors",
                                  isChosen
                                    ? "border-primary bg-primary/5 font-semibold text-foreground"
                                    : "border-border hover:bg-secondary-bg text-foreground",
                                )}
                              >
                                <span className="flex items-center gap-2.5">
                                  <input
                                    type={group.isMulti ? "checkbox" : "radio"}
                                    name={group.id}
                                    value={opt.id}
                                    checked={isChosen}
                                    onChange={() => toggleModalOption(group, opt.id)}
                                    className="accent-primary"
                                  />
                                  <span>{opt.name}</span>
                                </span>
                                {opt.priceAdjustment > 0 && (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    +{formatRupiah(opt.priceAdjustment)}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                      </div>
                    </fieldset>
                  );
                })}

                {/* Catatan Tambahan & Quick Notes Chips */}
                <div className="space-y-2 border-t border-border pt-4">
                  <label
                    htmlFor="cashier-item-note"
                    className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Catatan Khusus (Opsional)
                  </label>

                  {quickNotes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {quickNotes.map((chip) => {
                        const active = modalItemNotes.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              if (active) {
                                setModalItemNotes((prev) =>
                                  prev
                                    .replace(chip, "")
                                    .replace(/,\s*,/g, ",")
                                    .replace(/^\s*,\s*|\s*,\s*$/g, "")
                                    .trim(),
                                );
                              } else {
                                setModalItemNotes((prev) => (prev ? `${prev}, ${chip}` : chip));
                              }
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary-bg text-muted-foreground hover:bg-border/60 hover:text-foreground",
                            )}
                          >
                            <span>{active ? "✓" : "+"}</span>
                            <span>{chip}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <textarea
                    id="cashier-item-note"
                    value={modalItemNotes}
                    onChange={(e) => setModalItemNotes(e.target.value.slice(0, 255))}
                    rows={2}
                    placeholder="Contoh: gula dikurangi, kuah dipisah, jangan pakai bawang..."
                    className="w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Footer Form: Stepper Kuantitas & Tombol Masukkan ke Keranjang POS */}
            <div className="border-t border-border bg-white p-4 shadow-lg">
              <div className="flex items-center gap-3">
                {/* Quantity Stepper */}
                <div className="flex items-center border border-border rounded-xl bg-white p-1 shadow-2xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                    disabled={modalQty <= 1}
                    className="size-8 rounded-lg flex items-center justify-center hover:bg-secondary-bg text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                    title="Kurangi kuantitas"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-sm text-foreground">
                    {modalQty}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalQty((q) => {
                        const maxAllowed =
                          customizingProduct.availableQty -
                          getQtyInCartForProduct(customizingProduct.id);
                        return Math.min(maxAllowed, q + 1);
                      })
                    }
                    disabled={
                      modalQty >=
                      customizingProduct.availableQty -
                        getQtyInCartForProduct(customizingProduct.id)
                    }
                    className="size-8 rounded-lg flex items-center justify-center hover:bg-secondary-bg text-primary disabled:opacity-40 transition-colors"
                    title="Tambah kuantitas"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleConfirmModalProduct}
                  disabled={missingRequiredInModal}
                  className="h-11 flex-1 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-between px-4 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    <span>+ Masukkan ke Keranjang POS</span>
                  </span>
                  <span className="font-mono text-sm font-black">
                    {formatRupiah(modalTotalPrice)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
