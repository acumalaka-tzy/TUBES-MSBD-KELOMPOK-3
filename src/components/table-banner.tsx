"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { QrCode, X } from "lucide-react";
import { setActiveTable, useActiveTable } from "@/lib/active-table";

function clean(value: string | null) {
  return value ? value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 6) : "";
}

function Banner() {
  const pathname = usePathname();
  const params = useSearchParams();
  // `table` = parameter yang dipakai halaman Checkout; `meja` tetap didukung
  const fromUrl = clean(params.get("table") ?? params.get("meja"));
  const stored = useActiveTable();
  const table = fromUrl || stored;

  useEffect(() => {
    // Validasi token QR di server (TableQrCodes) sesuai PRD 5.2 / TC-01 & TC-02.
    if (fromUrl) setActiveTable(fromUrl);
  }, [fromUrl]);

  if (pathname.startsWith("/admin") || !table) return null;

  const handleClear = () => {
    setActiveTable(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("table");
      url.searchParams.delete("meja");
      window.history.replaceState(
        {},
        "",
        url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "")
      );
    }
  };

  return (
    <div className="bg-primary text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2 mx-auto">
          <QrCode className="size-4" aria-hidden />
          <span>
            Anda memesan untuk: <strong className="font-bold">Meja {table}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 text-[11px] bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-md transition-colors ml-auto"
          title="Hapus sesi meja"
        >
          <X className="size-3" />
          <span>Hapus Meja</span>
        </button>
      </div>
    </div>
  );
}

/** Banner konteks meja aktif (muncul jika pelanggan masuk lewat QR meja). */
export function TableBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}
