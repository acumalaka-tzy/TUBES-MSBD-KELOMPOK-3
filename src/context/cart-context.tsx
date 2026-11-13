"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartOption {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
}

export interface CartItem {
  id: string; // unique item key (productId + serialized options)
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  options: CartOption[];
  itemNotes?: string;
  subtotal: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "subtotal">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  loadSampleItems: () => void;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "warkop_agam_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setItems(JSON.parse(saved));
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

  const addItem = (item: Omit<CartItem, "id" | "subtotal">) => {
    const id = `${item.productId}-${JSON.stringify(item.options)}-${item.itemNotes || ""}`;
    const subtotal = calculateItemSubtotal(
      item.unitPrice,
      item.options,
      item.quantity
    );

    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        const newQty = existing.quantity + item.quantity;
        return prev.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity: newQty,
                subtotal: calculateItemSubtotal(i.unitPrice, i.options, newQty),
              }
            : i
        );
      }
      return [...prev, { ...item, id, subtotal }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: calculateItemSubtotal(item.unitPrice, item.options, newQty),
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const loadSampleItems = () => {
    const sampleItems: CartItem[] = [
      {
        id: "sample-indomie-bangladesh",
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
      },
      {
        id: "sample-kopi-sanger",
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
      },
    ];
    setItems(sampleItems);
  };

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = Math.round(subtotal * 0.1); // PB1 10%
  const totalAmount = subtotal + taxAmount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        loadSampleItems,
        subtotal,
        taxAmount,
        totalAmount,
        itemCount,
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

