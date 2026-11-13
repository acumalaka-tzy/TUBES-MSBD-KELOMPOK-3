"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Menentukan Buka/Tutup dari teks jam operasional, cth:
 * "Senin - Minggu, 07.00 - 02.00 WIB" (mendukung jam tutup lewat tengah malam).
 * Jika teks tidak bisa dibaca, dianggap Buka.
 */
function parseHours(text: string): { open: number; close: number } | null {
  const m = text.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return { open: Number(m[1]) * 60 + Number(m[2]), close: Number(m[3]) * 60 + Number(m[4]) };
}

function isOpenNow(text: string, now: Date) {
  const range = parseHours(text);
  if (!range) return true;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return range.open <= range.close
    ? minutes >= range.open && minutes < range.close
    : minutes >= range.open || minutes < range.close; // lewat tengah malam
}

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/** Status Buka/Tutup otomatis (dihitung di client). `forceClosed` = saklar web ordering dimatikan admin. */
export function OpenStatus({
  openingHours,
  forceClosed = false,
  className,
}: {
  openingHours: string;
  forceClosed?: boolean;
  className?: string;
}) {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => !forceClosed && isOpenNow(openingHours, new Date()),
    () => null,
  );
  if (isOpen === null) return <span className={cn("inline-block h-7 w-20", className)} aria-hidden />;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        isOpen ? "bg-success/10 text-success" : "bg-error/10 text-error",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", isOpen ? "bg-success" : "bg-error")} aria-hidden />
      {isOpen ? "Buka" : "Tutup"}
    </span>
  );
}
