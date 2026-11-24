"use server";

import { getPublicStoreSettings } from "@/lib/admin/queries";
import type { PublicStoreSettings } from "@/lib/admin/types";

/**
 * Mengambil konfigurasi publik toko (status buka/tutup web ordering
 * dan batas waktu pembayaran) untuk Cart & Checkout.
 */
export async function getPublicStoreSettingsAction(): Promise<PublicStoreSettings> {
  return getPublicStoreSettings();
}
