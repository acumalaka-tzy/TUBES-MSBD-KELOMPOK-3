import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number | null | undefined) {
  const num = typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value) ? value : 0;
  return rupiah.format(num);
}
