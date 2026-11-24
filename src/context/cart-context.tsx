"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { sampleProducts } from "@/lib/menu-data";
import { getPublicStoreSettingsAction } from "@/app/actions/store";
import { getCurrentUserAction } from "@/app/actions/auth";
import {
  getActiveCartAction,
  replaceWithNewCartAction,
  syncActiveCartAction,
} from "@/actions/cart";
import type { PublicStoreSettings } from "@/lib/admin/types";

const DEFAULT_STORE_SETTINGS: PublicStoreSettings = {
  isWebOrderingOpen: true,
  digitalExpiryMinutes: 15,
  cashExpiryMinutes: 30,
};

export interface CartOption {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
}

export interface CartItem {
  id: string; // unique item key (productId + serialized options + notes)
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  options: CartOption[];
  itemNotes?: string;
  subtotal: number;
  imageUrl?: string;
  emoji?: string;
  categoryName?: string;
  maxStock?: number;
}

export type ServiceTypeOption = "DINE_IN" | "TAKEAWAY";

interface CartContextType {
  items: CartItem[];
  cartToken: string;
  addItem: (item: Omit<CartItem, "id" | "subtotal">) => { added: number; cappedByStock: boolean };
  updateItem: (oldId: string, updated: Omit<CartItem, "id" | "subtotal">) => void;
  updateItemNotes: (id: string, itemNotes: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  setItemQuantity: (id: string, quantity: number) => void;
  getProductCartQuantity: (productId: string, excludeCartItemId?: string) => number;
  getProductMaxStock: (productId: string, fallbackMaxStock?: number) => number;
  clearCart: () => void;
  startNewCart: (initialItems?: Omit<CartItem, "id" | "subtotal">[]) => void;
  completeCheckout: (processedItemIds?: string[]) => void;
  loadSampleItems: () => void;
  subtotal: number;
  totalAmount: number;
  itemCount: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  serviceType: ServiceTypeOption;
  setServiceType: (type: ServiceTypeOption) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  storeSettings: PublicStoreSettings;
  refreshStoreSettings: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const LEGACY_STORAGE_KEY = "warkop_agam_cart";
const LEGACY_PREFS_STORAGE_KEY = "warkop_agam_cart_prefs";
const CART_KEY_PREFIX = "warkop_agam_cart:";

interface StoredCartPayload {
  cartToken: string;
  items: CartItem[];
  serviceType: ServiceTypeOption;
  orderNotes: string;
  updatedAt: number;
}

function getScopedCartStorageKey(userId: string | null): string {
  return userId ? `${CART_KEY_PREFIX}user:${userId}` : `${CART_KEY_PREFIX}guest`;
}

function generateClientCartToken(): string {
  return `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOptions(options: CartOption[]): CartOption[] {
  return options.map((o) => ({
    groupName: o.groupName,
    optionName: o.optionName,
    priceAdjustment: Number(o.priceAdjustment) || 0,
  }));
}

function buildCartItemId(productId: string, options: CartOption[], itemNotes?: string): string {
  const cleanNote = itemNotes?.trim() || "";
  return `${productId}-${JSON.stringify(normalizeOptions(options))}-${cleanNote}`;
}

function enrichCartItemMeta(item: CartItem): CartItem {
  const catalogMatch = sampleProducts.find((p) => p.id === item.productId);
  return {
    ...item,
    imageUrl: item.imageUrl ?? catalogMatch?.imageUrl,
    emoji: item.emoji ?? catalogMatch?.emoji ?? "🍽️",
    categoryName: item.categoryName ?? catalogMatch?.categoryName,
    maxStock:
      typeof item.maxStock === "number" && item.maxStock > 0
        ? item.maxStock
        : catalogMatch?.availableQty ?? 99,
  };
}

function readLocalCartPayload(storageKey: string): StoredCartPayload | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredCartPayload>;
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        return {
          cartToken:
            typeof parsed.cartToken === "string" && parsed.cartToken
              ? parsed.cartToken
              : generateClientCartToken(),
          items: parsed.items.map(enrichCartItemMeta),
          serviceType: parsed.serviceType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
          orderNotes: typeof parsed.orderNotes === "string" ? parsed.orderNotes : "",
          updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        };
      }
    }

    // Migrasi aman hanya satu kali dari legacy storage jika belum ada scoped key
    if (storageKey === `${CART_KEY_PREFIX}guest`) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const parsedLegacy = JSON.parse(legacyRaw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        let serviceType: ServiceTypeOption = "DINE_IN";
        let orderNotes = "";
        const legacyPrefsRaw = localStorage.getItem(LEGACY_PREFS_STORAGE_KEY);
        if (legacyPrefsRaw) {
          const lp = JSON.parse(legacyPrefsRaw) as {
            serviceType?: ServiceTypeOption;
            orderNotes?: string;
          };
          if (lp.serviceType === "TAKEAWAY") serviceType = "TAKEAWAY";
          if (typeof lp.orderNotes === "string") orderNotes = lp.orderNotes;
          localStorage.removeItem(LEGACY_PREFS_STORAGE_KEY);
        }
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          return {
            cartToken: generateClientCartToken(),
            items: parsedLegacy.map(enrichCartItemMeta),
            serviceType,
            orderNotes,
            updatedAt: Date.now(),
          };
        }
      }
    }
  } catch (e) {
    console.error("Gagal membaca cart dari localStorage", e);
  }
  return null;
}

function writeLocalCartPayload(storageKey: string, payload: StoredCartPayload): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PREFS_STORAGE_KEY);
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (e) {
    console.error("Gagal menyimpan cart ke localStorage", e);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartToken, setCartToken] = useState<string>(() => generateClientCartToken());
  const [serviceType, setServiceType] = useState<ServiceTypeOption>("DINE_IN");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const storageKeyRef = useRef<string>(`${CART_KEY_PREFIX}guest`);
  const cartTokenRef = useRef<string>(cartToken);
  const itemsRef = useRef<CartItem[]>(items);
  const serviceTypeRef = useRef<ServiceTypeOption>(serviceType);
  const orderNotesRef = useRef<string>(orderNotes);
  const skipNextAutoSyncRef = useRef<boolean>(false);

  useEffect(() => {
    cartTokenRef.current = cartToken;
  }, [cartToken]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    serviceTypeRef.current = serviceType;
  }, [serviceType]);
  useEffect(() => {
    orderNotesRef.current = orderNotes;
  }, [orderNotes]);

  // 1. Hydrate scoped local cart + sinkronkan dengan state server/DB saat mount
  useEffect(() => {
    let active = true;

    async function hydrateAndSync() {
      const user = await getCurrentUserAction().catch(() => null);
      if (!active) return;

      const scopedKey = getScopedCartStorageKey(user?.id ?? null);
      storageKeyRef.current = scopedKey;

      const localData = readLocalCartPayload(scopedKey);
      let resolvedToken = localData?.cartToken ?? generateClientCartToken();
      let resolvedItems = localData?.items ?? [];
      let resolvedService: ServiceTypeOption = localData?.serviceType ?? "DINE_IN";
      let resolvedNotes = localData?.orderNotes ?? "";
      const localUpdatedAt = localData?.updatedAt ?? 0;

      try {
        const serverSnap = await getActiveCartAction({ cartToken: resolvedToken });
        if (!active) return;

        if (serverSnap.status === "CHECKED_OUT" || serverSnap.status === "REPLACED") {
          // Keranjang dengan token ini sudah selesai di-checkout atau diganti: bersihkan paksa item lama!
          resolvedToken = generateClientCartToken();
          resolvedItems = [];
          resolvedNotes = "";
          writeLocalCartPayload(scopedKey, {
            cartToken: resolvedToken,
            items: [],
            serviceType: resolvedService,
            orderNotes: "",
            updatedAt: Date.now(),
          });
        } else if (serverSnap.status === "ACTIVE") {
          const serverUpdatedAt = new Date(serverSnap.updatedAt).getTime() || 0;
          const shouldTakeServer =
            serverSnap.cartToken === resolvedToken
              ? serverUpdatedAt > localUpdatedAt || (resolvedItems.length === 0 && serverSnap.items.length > 0)
              : resolvedItems.length === 0 && serverSnap.items.length > 0;

          if (shouldTakeServer) {
            resolvedToken = serverSnap.cartToken;
            resolvedItems = serverSnap.items.map(enrichCartItemMeta);
            resolvedService = serverSnap.serviceType;
            resolvedNotes = serverSnap.orderNotes;
            writeLocalCartPayload(scopedKey, {
              cartToken: resolvedToken,
              items: resolvedItems,
              serviceType: resolvedService,
              orderNotes: resolvedNotes,
              updatedAt: Date.now(),
            });
          } else if (resolvedItems.length > 0) {
            void syncActiveCartAction({
              cartToken: resolvedToken,
              serviceType: resolvedService,
              orderNotes: resolvedNotes,
              items: resolvedItems,
            });
          }
        } else if (resolvedItems.length > 0) {
          // NOT_FOUND di server tetapi masih ada item lokal aktif: unggah ke server
          void syncActiveCartAction({
            cartToken: resolvedToken,
            serviceType: resolvedService,
            orderNotes: resolvedNotes,
            items: resolvedItems,
          });
        }
      } catch {
        // Offline / server fallback: tetap pakai local snapshot
      }

      if (!active) return;
      skipNextAutoSyncRef.current = true;
      cartTokenRef.current = resolvedToken;
      itemsRef.current = resolvedItems;
      serviceTypeRef.current = resolvedService;
      orderNotesRef.current = resolvedNotes;
      setCartToken(resolvedToken);
      setItems(resolvedItems);
      setServiceType(resolvedService);
      setOrderNotes(resolvedNotes);
      setIsLoaded(true);
    }

    void hydrateAndSync();

    // Sinkronisasi lintas-tab browser bila tab lain mengubah atau mengosongkan keranjang
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== storageKeyRef.current) return;
      const fresh = readLocalCartPayload(storageKeyRef.current);
      skipNextAutoSyncRef.current = true;
      if (fresh) {
        cartTokenRef.current = fresh.cartToken;
        itemsRef.current = fresh.items;
        setCartToken(fresh.cartToken);
        setItems(fresh.items);
        setServiceType(fresh.serviceType);
        setOrderNotes(fresh.orderNotes);
      } else {
        const freshToken = generateClientCartToken();
        cartTokenRef.current = freshToken;
        itemsRef.current = [];
        setCartToken(freshToken);
        setItems([]);
        setOrderNotes("");
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // 2. Sinkronisasi otomatis localStorage & server setiap kali keranjang berubah
  useEffect(() => {
    if (!isLoaded) return;

    writeLocalCartPayload(storageKeyRef.current, {
      cartToken,
      items,
      serviceType,
      orderNotes,
      updatedAt: Date.now(),
    });

    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void syncActiveCartAction({
        cartToken: cartTokenRef.current,
        serviceType: serviceTypeRef.current,
        orderNotes: orderNotesRef.current,
        items: itemsRef.current,
      }).then((res) => {
        if (res.alreadyClosed) {
          // Token ini sudah ditandai selesai/diganti di server (mis. dari tab lain): reset agar item lama tidak muncul lagi
          const freshToken = generateClientCartToken();
          skipNextAutoSyncRef.current = true;
          cartTokenRef.current = freshToken;
          itemsRef.current = [];
          setCartToken(freshToken);
          setItems([]);
          setOrderNotes("");
          writeLocalCartPayload(storageKeyRef.current, {
            cartToken: freshToken,
            items: [],
            serviceType: serviceTypeRef.current,
            orderNotes: "",
            updatedAt: Date.now(),
          });
        }
      }).catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [items, serviceType, orderNotes, cartToken, isLoaded]);

  const calculateItemSubtotal = (
    unitPrice: number,
    options: CartOption[],
    quantity: number
  ) => {
    const optionsTotal = options.reduce(
      (sum, opt) => sum + (Number(opt.priceAdjustment) || 0),
      0
    );
    return (unitPrice + optionsTotal) * quantity;
  };

  const getProductMaxStock = useCallback(
    (productId: string, fallbackMaxStock?: number) => {
      if (typeof fallbackMaxStock === "number" && fallbackMaxStock >= 0) {
        return fallbackMaxStock;
      }
      const inCart = items.find((i) => i.productId === productId && typeof i.maxStock === "number");
      if (inCart?.maxStock !== undefined) return inCart.maxStock;
      const catalogMatch = sampleProducts.find((p) => p.id === productId);
      return catalogMatch ? catalogMatch.availableQty : 99;
    },
    [items]
  );

  const getProductCartQuantity = useCallback(
    (productId: string, excludeCartItemId?: string) => {
      return items
        .filter((i) => i.productId === productId && i.id !== excludeCartItemId)
        .reduce((sum, i) => sum + i.quantity, 0);
    },
    [items]
  );

  const addItem = (item: Omit<CartItem, "id" | "subtotal">) => {
    const cleanNote = item.itemNotes?.trim() || undefined;
    const normalizedOpts = normalizeOptions(item.options);
    const id = buildCartItemId(item.productId, normalizedOpts, cleanNote);
    const maxStock = getProductMaxStock(item.productId, item.maxStock);
    const currentProductQty = getProductCartQuantity(item.productId);
    const remainingAllowed = Math.max(0, maxStock - currentProductQty);
    const actualAddQty = Math.min(item.quantity, remainingAllowed);
    const cappedByStock = actualAddQty < item.quantity;

    if (actualAddQty <= 0) {
      return { added: 0, cappedByStock: true };
    }

    setItems((prev) => {
      const totalForProduct = prev
        .filter((i) => i.productId === item.productId)
        .reduce((s, i) => s + i.quantity, 0);
      const allowed = Math.max(0, maxStock - totalForProduct);
      const addQty = Math.min(item.quantity, allowed);
      if (addQty <= 0) return prev;

      const existing = prev.find((i) => i.id === id);
      if (existing) {
        const newQty = existing.quantity + addQty;
        return prev.map((i) =>
          i.id === id
            ? enrichCartItemMeta({
                ...i,
                maxStock,
                quantity: newQty,
                subtotal: calculateItemSubtotal(i.unitPrice, i.options, newQty),
              })
            : i
        );
      }

      const subtotal = calculateItemSubtotal(item.unitPrice, normalizedOpts, addQty);
      return [
        ...prev,
        enrichCartItemMeta({
          ...item,
          options: normalizedOpts,
          itemNotes: cleanNote,
          maxStock,
          quantity: addQty,
          id,
          subtotal,
        }),
      ];
    });

    return { added: actualAddQty, cappedByStock };
  };

  const updateItem = (oldId: string, updated: Omit<CartItem, "id" | "subtotal">) => {
    const cleanNote = updated.itemNotes?.trim() || undefined;
    const normalizedOpts = normalizeOptions(updated.options);
    const newId = buildCartItemId(updated.productId, normalizedOpts, cleanNote);

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === oldId);
      if (oldIndex === -1) return prev;

      const maxStock = getProductMaxStock(updated.productId, updated.maxStock ?? prev[oldIndex].maxStock);
      const otherQty = prev
        .filter((i) => i.productId === updated.productId && i.id !== oldId && i.id !== newId)
        .reduce((s, i) => s + i.quantity, 0);

      const duplicateTarget = newId !== oldId ? prev.find((i) => i.id === newId) : undefined;
      const combinedRequestedQty = updated.quantity + (duplicateTarget ? duplicateTarget.quantity : 0);
      const finalQty = Math.max(1, Math.min(combinedRequestedQty, Math.max(1, maxStock - otherQty)));

      const newItem: CartItem = enrichCartItemMeta({
        ...prev[oldIndex],
        ...updated,
        options: normalizedOpts,
        itemNotes: cleanNote,
        maxStock,
        id: newId,
        quantity: finalQty,
        subtotal: calculateItemSubtotal(updated.unitPrice, normalizedOpts, finalQty),
      });

      if (duplicateTarget) {
        return prev
          .map((item, idx) => (idx === oldIndex ? newItem : item))
          .filter((item, idx) => idx === oldIndex || item.id !== newId);
      }

      return prev.map((item, idx) => (idx === oldIndex ? newItem : item));
    });
  };

  const updateItemNotes = (id: string, itemNotes: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      const cleanNote = itemNotes.trim() || undefined;
      const newId = buildCartItemId(target.productId, target.options, cleanNote);

      if (newId === id) {
        return prev.map((i) => (i.id === id ? { ...i, itemNotes: cleanNote } : i));
      }

      const existingSame = prev.find((i) => i.id === newId);
      if (existingSame) {
        const maxStock = getProductMaxStock(target.productId, target.maxStock);
        const otherQty = prev
          .filter((i) => i.productId === target.productId && i.id !== id && i.id !== newId)
          .reduce((s, i) => s + i.quantity, 0);
        const mergedQty = Math.min(existingSame.quantity + target.quantity, Math.max(1, maxStock - otherQty));
        return prev
          .map((i) =>
            i.id === newId
              ? {
                  ...i,
                  quantity: mergedQty,
                  subtotal: calculateItemSubtotal(i.unitPrice, i.options, mergedQty),
                }
              : i
          )
          .filter((i) => i.id !== id);
      }

      return prev.map((i) =>
        i.id === id
          ? {
              ...i,
              id: newId,
              itemNotes: cleanNote,
            }
          : i
      );
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;

      if (delta > 0) {
        const maxStock = getProductMaxStock(target.productId, target.maxStock);
        const totalProductQty = prev
          .filter((i) => i.productId === target.productId)
          .reduce((s, i) => s + i.quantity, 0);
        if (totalProductQty >= maxStock) {
          return prev;
        }
      }

      return prev
        .map((item) => {
          if (item.id === id) {
            const maxStock = getProductMaxStock(item.productId, item.maxStock);
            const otherQty = prev
              .filter((i) => i.productId === item.productId && i.id !== id)
              .reduce((s, i) => s + i.quantity, 0);
            const newQty = Math.min(item.quantity + delta, Math.max(0, maxStock - otherQty));
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: calculateItemSubtotal(item.unitPrice, item.options, newQty),
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const setItemQuantity = (id: string, quantity: number) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      if (quantity <= 0) return prev.filter((i) => i.id !== id);

      const maxStock = getProductMaxStock(target.productId, target.maxStock);
      const otherQty = prev
        .filter((i) => i.productId === target.productId && i.id !== id)
        .reduce((s, i) => s + i.quantity, 0);
      const clampedQty = Math.min(quantity, Math.max(1, maxStock - otherQty));

      return prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: clampedQty,
              subtotal: calculateItemSubtotal(item.unitPrice, item.options, clampedQty),
            }
          : item
      );
    });
  };

  /**
   * Membuat keranjang baru yang benar-benar bersih tanpa membawa item dari keranjang sebelumnya,
   * sekaligus menandai keranjang lama sebagai REPLACED di server dan menulis sinkron ke localStorage.
   */
  const startNewCart = useCallback(
    (initialItems: Omit<CartItem, "id" | "subtotal">[] = []) => {
      const prevToken = cartTokenRef.current;
      const nextToken = generateClientCartToken();

      const builtItems: CartItem[] = [];
      for (const raw of initialItems) {
        const cleanNote = raw.itemNotes?.trim() || undefined;
        const normalizedOpts = normalizeOptions(raw.options);
        const id = buildCartItemId(raw.productId, normalizedOpts, cleanNote);
        const maxStock = getProductMaxStock(raw.productId, raw.maxStock);
        const qty = Math.max(1, Math.min(raw.quantity, maxStock));
        builtItems.push(
          enrichCartItemMeta({
            ...raw,
            options: normalizedOpts,
            itemNotes: cleanNote,
            maxStock,
            quantity: qty,
            id,
            subtotal: calculateItemSubtotal(raw.unitPrice, normalizedOpts, qty),
          })
        );
      }

      skipNextAutoSyncRef.current = true;
      cartTokenRef.current = nextToken;
      itemsRef.current = builtItems;
      orderNotesRef.current = "";

      setCartToken(nextToken);
      setItems(builtItems);
      setOrderNotes("");

      writeLocalCartPayload(storageKeyRef.current, {
        cartToken: nextToken,
        items: builtItems,
        serviceType: serviceTypeRef.current,
        orderNotes: "",
        updatedAt: Date.now(),
      });

      void replaceWithNewCartAction({
        previousCartToken: prevToken,
        newCartToken: nextToken,
        serviceType: serviceTypeRef.current,
        orderNotes: "",
        items: builtItems,
      }).catch(() => {});
    },
    [getProductMaxStock]
  );

  const clearCart = useCallback(() => {
    startNewCart([]);
  }, [startNewCart]);

  /**
   * Dipanggil HANYA saat checkout berhasil: menghapus item yang telah diproses dari keranjang aktif,
   * merotasi token keranjang baru, dan menyinkronkan localStorage secara instan sebelum navigasi.
   */
  const completeCheckout = useCallback((processedItemIds?: string[]) => {
    const processedSet =
      processedItemIds && processedItemIds.length > 0 ? new Set(processedItemIds) : null;
    const remaining = processedSet
      ? itemsRef.current.filter((it) => !processedSet.has(it.id))
      : [];

    const nextToken = generateClientCartToken();
    const nextNotes = remaining.length === 0 ? "" : orderNotesRef.current;

    skipNextAutoSyncRef.current = true;
    cartTokenRef.current = nextToken;
    itemsRef.current = remaining;
    orderNotesRef.current = nextNotes;

    setCartToken(nextToken);
    setItems(remaining);
    if (remaining.length === 0) {
      setOrderNotes("");
    }

    // Tulis sinkron ke localStorage sebelum router.push agar tidak ada item lama yang muncul kembali
    writeLocalCartPayload(storageKeyRef.current, {
      cartToken: nextToken,
      items: remaining,
      serviceType: serviceTypeRef.current,
      orderNotes: nextNotes,
      updatedAt: Date.now(),
    });

    if (remaining.length > 0) {
      void syncActiveCartAction({
        cartToken: nextToken,
        serviceType: serviceTypeRef.current,
        orderNotes: nextNotes,
        items: remaining,
      }).catch(() => {});
    }
  }, []);

  const loadSampleItems = () => {
    startNewCart([
      {
        productId: "prd-bangladesh-06",
        name: "Indomie Bangladesh",
        unitPrice: 15000,
        quantity: 2,
        options: [
          { groupName: "Pilihan Porsi & Puding", optionName: "Bangladesh Puding Ayam", priceAdjustment: 5000 },
          { groupName: "Level Pedas", optionName: "Pedas Ekstra", priceAdjustment: 0 },
        ],
        itemNotes: "Kuah nyemek pas, pedas nendang",
      },
      {
        productId: "prd-sanger-01",
        name: "Kopi Sanger",
        unitPrice: 12000,
        quantity: 2,
        options: [
          { groupName: "Varian & Penyajian", optionName: "Dingin (Es)", priceAdjustment: 2000 },
          { groupName: "Tingkat Manis", optionName: "Manis Normal", priceAdjustment: 0 },
        ],
        itemNotes: "Es batu jangan kebanyakan",
      },
    ]);
  };

  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings>(DEFAULT_STORE_SETTINGS);

  const refreshStoreSettings = useCallback(async () => {
    try {
      const fresh = await getPublicStoreSettingsAction();
      setStoreSettings(fresh);
    } catch {
      // Abaikan jika server sedang restart; tetap pakai state terakhir
    }
  }, []);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
    void refreshStoreSettings();
  }, [refreshStoreSettings]);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  useEffect(() => {
    let active = true;
    getPublicStoreSettingsAction()
      .then((fresh) => {
        if (active) setStoreSettings(fresh);
      })
      .catch(() => {
        // Abaikan jika server belum siap; pakai nilai bawaan
      });
    return () => {
      active = false;
    };
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAmount = subtotal;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cartToken,
        addItem,
        updateItem,
        updateItemNotes,
        removeItem,
        updateQuantity,
        setItemQuantity,
        getProductCartQuantity,
        getProductMaxStock,
        clearCart,
        startNewCart,
        completeCheckout,
        loadSampleItems,
        subtotal,
        totalAmount,
        itemCount,
        isCartOpen,
        openCart,
        closeCart,
        serviceType,
        setServiceType,
        orderNotes,
        setOrderNotes,
        storeSettings,
        refreshStoreSettings,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
