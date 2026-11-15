import { formatWhatsapp, type RestaurantInfo } from "@/lib/menu-data";

export interface OutletSocialLink {
  platform: string;
  handle: string;
  url: string;
}

export const OUTLET_PROFILE = {
  brandTitle: "Warkop Agam Medan",
  outletBadge: "Outlet Berdikari · Padang Bulan",
  menuAddressNote: "Jl. Berdikari Baru No. 21 B, Padang Bulan, Medan",
  tagline: "Nongki Sambil Nge-Indomie...",
  storefrontImage: "/images/warkop-agam-berdikari.jpg",
  storefrontAlt:
    "Tampak depan outlet Warkop Agam Medan Berdikari di Jalan Berdikari Baru No. 21 B, Padang Bulan, Medan",
  socials: [
    {
      platform: "Instagram",
      handle: "@medanwarkopagam",
      url: "https://instagram.com/medanwarkopagam",
    },
    {
      platform: "TikTok",
      handle: "@medanwarkopagam",
      url: "https://www.tiktok.com/@medanwarkopagam",
    },
  ] satisfies readonly OutletSocialLink[],
} as const;

export const OUTLET_FACILITY_ITEMS = [
  { key: "wifi", label: "Wi-Fi Gratis" },
  { key: "qr", label: "Order QR Meja" },
  { key: "power", label: "Stop Kontak Tiap Meja" },
  { key: "service", label: "Dine In & Takeaway" },
] as const;

/** Builds Google Maps and WhatsApp contact URLs consistently from restaurant settings. */
export function buildOutletLinks(restaurant: RestaurantInfo) {
  const mapsQuery = encodeURIComponent(`Warkop Agam, ${restaurant.address}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapsEmbedUrl = `https://maps.google.com/maps?hl=id&q=${mapsQuery}&t=m&z=16&ie=UTF8&iwloc=&output=embed`;

  const waMessage = encodeURIComponent(
    `Halo ${restaurant.name}, saya ingin bertanya terkait pesanan atau ketersediaan meja.`,
  );
  const waUrl = `https://wa.me/${restaurant.whatsapp}?text=${waMessage}`;
  const formattedWa = formatWhatsapp(restaurant.whatsapp);

  return { mapsUrl, mapsEmbedUrl, waUrl, formattedWa };
}
