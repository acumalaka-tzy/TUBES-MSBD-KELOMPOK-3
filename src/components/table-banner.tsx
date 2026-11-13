"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { QrCode } from "lucide-react";
import { setActiveTable, useActiveTable } from "@/lib/active-table";

function clean(value: string | null) {
  return value ? value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 6) : "";
}

function Banner() {
  const params = useSearchParams();
  // `table` = parameter yang dipakai halaman Checkout; `meja` tetap didukung
  const fromUrl = clean(params.get("table") ?? params.get("meja"));
  const stored = useActiveTable();
  const table = fromUrl || stored;

  useEffect(() => {
    // TODO: validasi token QR di server (TableQrCodes) sesuai PRD 5.2 / TC-01 & TC-02.
    if (fromUrl) setActiveTable(fromUrl);
  }, [fromUrl]);

  if (!table) return null;

  return (
    <div className="bg-primary text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium">
        <QrCode className="size-4" aria-hidden />
        Anda memesan untuk: <strong className="font-bold">Meja {table}</strong>
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
