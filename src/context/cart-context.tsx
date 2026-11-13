"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { sampleProducts } from "@/lib/menu-data";
import { getPublicStoreSettingsAction } from "@/app/actions/store";
import type { PublicStoreSettings } from "@/lib/admin/types";

const DEFAULT_STORE_SETTINGS: PublicStoreSettings = {
  isWebOrderingOpen: true,
  taxEnabled: true,
  taxPercentage: 10,
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
  addItem: (item: Omit<CartItem, "id" | "subtotal">) => { added: number; cappedByStock: boolean };
  updateItem: (oldId: string, updated: Omit<CartItem, "id" | "subtotal">) => void;
  updateItemNotes: (id: string, itemNotes: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  setItemQuantity: (id: string, quantity: number) => void;
  getProductCartQuantity: (productId: string, excludeCartItemId?: string) => number;
  getProductMaxStock: (productId: string, fallbackMaxStock?: number) => number;
  clearCart: () => void;
  loadSampleItems: () => void;
  subtotal: number;
  taxAmount: number;
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
  taxLabel: string;
  refreshStoreSettings: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "warkop_agam_cart";
const PREFS_STORAGE_KEY = "warkop_agam_cart_prefs";

function normalizeOptions(options: CartOption[]): CartOption[] {
  return [...options].map((o) => ({
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [serviceType, setServiceType] = useState<ServiceTypeOption>("DINE_IN");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as CartItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed.map(enrichCartItemMeta));
          }
        }
        const savedPrefs = localStorage.getItem(PREFS_STORAGE_KEY);
        if (savedPrefs) {
          const prefs = JSON.parse(savedPrefs) as {
            serviceType?: ServiceTypeOption;
            orderNotes?: string;
          };
          if (prefs.serviceType === "DINE_IN" || prefs.serviceType === "TAKEAWAY") {
            setServiceType(prefs.serviceType);
          }
          if (typeof prefs.orderNotes === "string") {
            setOrderNotes(prefs.orderNotes);
          }
        }
      } catch (e) {
        console.error("Gagal membaca cart dari localStorage", e);
      } finally {
        setIsLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error("Gagal menyimpan cart ke localStorage", e);
      }
    }
  }, [items, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(
          PREFS_STORAGE_KEY,
          JSON.stringify({ serviceType, orderNotes })
        );
      } catch (e) {
        console.error("Gagal menyimpan preferensi cart ke localStorage", e);
      }
    }
  }, [serviceType, orderNotes, isLoaded]);

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
        // Merge into the position of oldIndex and remove the duplicate entry
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

  const clearCart = () => {
    setItems([]);
    setOrderNotes("");
  };

  const loadSampleItems = () => {
    const sampleItems: CartItem[] = [
      enrichCartItemMeta({
        id: buildCartItemId(
          "prd-bangladesh-06",
          [
            { groupName: "Level Pedas", optionName: "Pedas Ekstra", priceAdjustment: 0 },
            { groupName: "Tambahan Topping", optionName: "Tambah Telur Setengah Matang", priceAdjustment: 4000 },
          ],
          "Kuah nyemek pas, pedas nendang"
        ),
        productId: "prd-bangladesh-06",
        name: "Indomie Bangladesh Spesial",
        unitPrice: 18000,
        quantity: 2,
        options: [
          { groupName: "Level Pedas", optionName: "Pedas Ekstra", priceAdjustment: 0 },
          { groupName: "Tambahan Topping", optionName: "Tambah Telur Setengah Matang", priceAdjustment: 4000 },
        ],
        itemNotes: "Kuah nyemek pas, pedas nendang",
        subtotal: 44000, // (18000 + 4000) * 2
      }),
      enrichCartItemMeta({
        id: buildCartItemId(
          "prd-sanger-01",
          [
            { groupName: "Suhu Penyajian", optionName: "Dingin (Es)", priceAdjustment: 2000 },
            { groupName: "Tingkat Manis", optionName: "Manis Normal", priceAdjustment: 0 },
          ],
          "Es batu jangan kebanyakan"
        ),
        productId: "prd-sanger-01",
        name: "Kopi Sanger Espresso",
        unitPrice: 14000,
        quantity: 2,
        options: [
          { groupName: "Suhu Penyajian", optionName: "Dingin (Es)", priceAdjustment: 2000 },
          { groupName: "Tingkat Manis", optionName: "Manis Normal", priceAdjustment: 0 },
        ],
        itemNotes: "Es batu jangan kebanyakan",
        subtotal: 32000, // (14000 + 2000) * 2
      }),
    ];
    setItems(sampleItems);
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
  const taxAmount = storeSettings.taxEnabled
    ? Math.round(subtotal * (storeSettings.taxPercentage / 100))
    : 0;
  const taxLabel = storeSettings.taxEnabled
    ? `Pajak Restoran (PB1 ${storeSettings.taxPercentage}%)`
    : "Pajak Restoran (PB1 0% • Nonaktif)";
  const totalAmount = subtotal + taxAmount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        updateItemNotes,
        removeItem,
        updateQuantity,
        setItemQuantity,
        getProductCartQuantity,
        getProductMaxStock,
        clearCart,
        loadSampleItems,
        subtotal,
        taxAmount,
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
        taxLabel,
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


