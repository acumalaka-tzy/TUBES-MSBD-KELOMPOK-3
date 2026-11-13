/**
 * Data katalog Warkop Agam (selaras dengan `prisma/seed.ts` & skema MySQL 17 tabel di PRD).
 * Dipakai sebagai:
 * 1. Definisi tipe untuk seluruh komponen Homepage & Katalog Menu.
 * 2. Fallback otomatis ketika database MySQL belum terkoneksi / belum di-seed.
 */

export type StockStatus = "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
}

export interface OptionItem {
  id: string;
  name: string;
  price: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  items: OptionItem[];
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  basePrice: number;
  emoji: string;
  /** Path foto di folder public/ (cth: /images/menu/kopi-sanger.webp atau /menu/prd-sanger-01.svg) */
  imageUrl?: string;
  /** Sisa porsi tersedia (product_stocks.available_qty) */
  availableQty: number;
  minThreshold: number;
  /** Skor popularitas untuk pengurutan & Best Seller */
  popularity: number;
  sortOrder?: number;
  bestSeller?: boolean;
  options: OptionGroup[];
}

export const sampleCategories: Category[] = [
  {
    id: "cat-kopi-01",
    slug: "kopi-minuman-hangat",
    name: "Kopi & Minuman Hangat",
    description: "Racikan kopi saring khas Aceh-Medan dan teh tarik legendaris.",
    emoji: "☕",
  },
  {
    id: "cat-dingin-02",
    slug: "minuman-dingin-segar",
    name: "Minuman Dingin & Segar",
    description: "Minuman dingin penyegar dahaga khas warkop.",
    emoji: "🧋",
  },
  {
    id: "cat-mie-03",
    slug: "mie-makanan-berat",
    name: "Mie & Makanan Berat",
    description: "Indomie Bangladesh, nasi goreng, dan hidangan mengenyangkan.",
    emoji: "🍜",
  },
  {
    id: "cat-camilan-04",
    slug: "roti-bakar-camilan",
    name: "Roti Bakar & Camilan",
    description: "Teman ngopi santai mulai dari roti bakar hingga martabak mie.",
    emoji: "🍞",
  },
];

const optSuhu: OptionGroup = {
  id: "og-suhu",
  name: "Suhu Penyajian",
  type: "single",
  required: true,
  items: [
    { id: "oi-panas", name: "Panas", price: 0 },
    { id: "oi-dingin", name: "Dingin (Es)", price: 2000 },
  ],
};

const optManis: OptionGroup = {
  id: "og-gula",
  name: "Tingkat Manis",
  type: "single",
  required: true,
  items: [
    { id: "oi-manis-normal", name: "Manis Normal", price: 0 },
    { id: "oi-manis-less", name: "Less Sugar", price: 0 },
  ],
};

const optPedas: OptionGroup = {
  id: "og-pedas",
  name: "Level Pedas",
  type: "single",
  required: true,
  items: [
    { id: "oi-pedas-sedang", name: "Pedas Sedang (Standar)", price: 0 },
    { id: "oi-pedas-ekstra", name: "Pedas Ekstra", price: 0 },
    { id: "oi-pedas-tidak", name: "Tidak Pedas", price: 0 },
  ],
};

const optToppingMie: OptionGroup = {
  id: "og-topping",
  name: "Tambahan Topping",
  type: "multi",
  required: false,
  items: [
    { id: "oi-top-telur", name: "Tambah Telur Setengah Matang", price: 4000 },
    { id: "oi-top-sosis", name: "Tambah Sosis Ayam", price: 5000 },
    { id: "oi-top-keju", name: "Tambah Keju Parut", price: 4000 },
  ],
};

const productList: Omit<Product, "categoryName">[] = [
  {
    id: "prd-sanger-01",
    categoryId: "cat-kopi-01",
    name: "Kopi Sanger Espresso",
    description: "Perpaduan kopi robusta saring kental dengan susu kental manis pas takaran.",
    basePrice: 14000,
    emoji: "☕",
    imageUrl: "/menu/prd-sanger-01.svg",
    availableQty: 50,
    minThreshold: 5,
    popularity: 98,
    bestSeller: true,
    options: [optSuhu, optManis],
  },
  {
    id: "prd-tehtarik-02",
    categoryId: "cat-kopi-01",
    name: "Teh Tarik Aceh",
    description: "Teh hitam pilihan ditarik berbusa lembut dengan susu creamy.",
    basePrice: 13000,
    emoji: "🫖",
    imageUrl: "/menu/prd-tehtarik-02.svg",
    availableQty: 45,
    minThreshold: 5,
    popularity: 92,
    bestSeller: true,
    options: [optSuhu],
  },
  {
    id: "prd-kopihitam-03",
    categoryId: "cat-kopi-01",
    name: "Kopi Hitam Ulee Kareng",
    description: "Kopi hitam khas Aceh dengan aroma kuat dan rasa autentik.",
    basePrice: 10000,
    emoji: "☕",
    imageUrl: "/menu/prd-kopihitam-03.svg",
    availableQty: 60,
    minThreshold: 5,
    popularity: 80,
    options: [optManis],
  },
  {
    id: "prd-kopijoss-09",
    categoryId: "cat-kopi-01",
    name: "Kopi Susu Gula Aren",
    description: "Espresso robusta dengan susu segar dan gula aren asli.",
    basePrice: 16000,
    emoji: "🥤",
    imageUrl: "/menu/prd-kopijoss-09.svg",
    availableQty: 3,
    minThreshold: 5,
    popularity: 84,
    options: [optSuhu, optManis],
  },
  {
    id: "prd-milo-04",
    categoryId: "cat-dingin-02",
    name: "Es Milo Kepal Warkop",
    description: "Es Milo kental dingin dengan taburan bubuk Milo melimpah.",
    basePrice: 16000,
    emoji: "🥤",
    imageUrl: "/menu/prd-milo-04.svg",
    availableQty: 30,
    minThreshold: 5,
    popularity: 86,
    options: [],
  },
  {
    id: "prd-badak-05",
    categoryId: "cat-dingin-02",
    name: "Es Soda Susu Badak",
    description: "Minuman legendaris Sumatera Utara: limun Sarsaparilla Badak dengan susu.",
    basePrice: 15000,
    emoji: "🧊",
    imageUrl: "/menu/prd-badak-05.svg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 79,
    options: [],
  },
  {
    id: "prd-jeruk-10",
    categoryId: "cat-dingin-02",
    name: "Es Jeruk Peras Murni",
    description: "Perasan jeruk manis segar dengan es batu kristal tanpa pengawet.",
    basePrice: 10000,
    emoji: "🍊",
    imageUrl: "/menu/prd-jeruk-10.svg",
    availableQty: 0,
    minThreshold: 5,
    popularity: 65,
    options: [],
  },
  {
    id: "prd-bangladesh-06",
    categoryId: "cat-mie-03",
    name: "Indomie Bangladesh Spesial",
    description: "Mie nyemek racikan bumbu rempah rahasia Warkop Agam dengan telur setengah matang.",
    basePrice: 18000,
    emoji: "🍜",
    imageUrl: "/menu/prd-bangladesh-06.svg",
    availableQty: 40,
    minThreshold: 5,
    popularity: 100,
    bestSeller: true,
    options: [optPedas, optToppingMie],
  },
  {
    id: "prd-nasgor-07",
    categoryId: "cat-mie-03",
    name: "Nasi Goreng Kampung Agam",
    description: "Nasi goreng bumbu terasi ringan, suwiran ayam, telur mata sapi, dan kerupuk.",
    basePrice: 22000,
    emoji: "🍳",
    imageUrl: "/menu/prd-nasgor-07.svg",
    availableQty: 25,
    minThreshold: 5,
    popularity: 95,
    bestSeller: true,
    options: [optPedas, optToppingMie],
  },
  {
    id: "prd-mieaceh-11",
    categoryId: "cat-mie-03",
    name: "Mie Aceh Daging Tumis",
    description: "Mie kuning tebal dimasak bumbu kari kental khas Aceh dengan irisan daging sapi.",
    basePrice: 26000,
    emoji: "🍲",
    imageUrl: "/menu/prd-mieaceh-11.svg",
    availableQty: 4,
    minThreshold: 5,
    popularity: 88,
    options: [optPedas],
  },
  {
    id: "prd-rotibakar-08",
    categoryId: "cat-camilan-04",
    name: "Roti Bakar Cokelat Keju",
    description: "Roti panggang garing di luar lembut di dalam dengan isian cokelat lumer dan keju parut.",
    basePrice: 15000,
    emoji: "🍞",
    imageUrl: "/menu/prd-rotibakar-08.svg",
    availableQty: 35,
    minThreshold: 5,
    popularity: 90,
    options: [],
  },
  {
    id: "prd-martabak-12",
    categoryId: "cat-camilan-04",
    name: "Martabak Mie Telur Bebek",
    description: "Martabak mie goreng gurih tebal disajikan dengan kuah acar cabai rawit.",
    basePrice: 17000,
    emoji: "🥞",
    imageUrl: "/menu/prd-martabak-12.svg",
    availableQty: 18,
    minThreshold: 5,
    popularity: 77,
    options: [optPedas],
  },
  {
    id: "prd-pisang-13",
    categoryId: "cat-camilan-04",
    name: "Pisang Goreng Srikaya",
    description: "Pisang kepok goreng krispi disajikan hangat dengan selai srikaya pandan.",
    basePrice: 12000,
    emoji: "🍌",
    imageUrl: "/menu/prd-pisang-13.svg",
    availableQty: 0,
    minThreshold: 5,
    popularity: 70,
    options: [],
  },
];

export const sampleProducts: Product[] = productList.map((p, index) => ({
  ...p,
  sortOrder: index,
  categoryName: sampleCategories.find((c) => c.id === p.categoryId)?.name ?? "",
  imageUrl: p.imageUrl ?? `/menu/${p.id}.svg`,
}));

export interface Promo {
  id: string;
  title: string;
  description: string;
  badge: string;
  code?: string;
}

export const promos: Promo[] = [
  {
    id: "promo-1",
    title: "Paket Pagi Warkop",
    description: "Nasi Goreng Kampung Agam + Kopi Hitam Ulee Kareng lebih hemat setiap pukul 07.00–11.00 WIB.",
    badge: "Hemat Pagi",
    code: "PAGIAGAM",
  },
  {
    id: "promo-2",
    title: "Kombo Nongkrong Malam",
    description: "Pesan 2 porsi Indomie Bangladesh Spesial + 2 Kopi Sanger gratis 1 porsi Roti Bakar.",
    badge: "Best Deal",
    code: "NONGKRONG",
  },
];

export interface RestaurantInfo {
  name: string;
  address: string;
  /** Nomor WhatsApp format internasional tanpa +, cth: 6281260001001 */
  whatsapp: string;
  /** Teks jam operasional, cth: "Senin - Minggu, 07.00 - 02.00 WIB" */
  openingHours: string;
  /** Saklar buka/tutup pemesanan web (restaurant_settings.is_web_ordering_open) */
  isWebOrderingOpen: boolean;
}

/** Selaras dengan `prisma/seed.ts` (RestaurantSetting). */
export const sampleRestaurant: RestaurantInfo = {
  name: "Warkop Agam",
  address: "Jl. H. Misbah No. 14, Medan Maimun, Kota Medan, Sumatera Utara",
  whatsapp: "6281260001001",
  openingHours: "Senin - Minggu, 07.00 - 02.00 WIB",
  isWebOrderingOpen: true,
};

export function formatWhatsapp(number: string) {
  const local = number.startsWith("62") ? `0${number.slice(2)}` : number;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

export function getStockStatus(availableQty: number, minThreshold: number): StockStatus {
  if (availableQty <= 0) return "OUT_OF_STOCK";
  if (availableQty <= minThreshold) return "LOW_STOCK";
  return "AVAILABLE";
}

export const stockLabel: Record<StockStatus, string> = {
  AVAILABLE: "Tersedia",
  LOW_STOCK: "Sisa Sedikit",
  OUT_OF_STOCK: "Habis",
};

/** Emoji cadangan kategori bila foto belum ada. */
export function emojiForCategory(slug: string): string {
  if (/kopi|hangat/.test(slug)) return "☕";
  if (/dingin|minum/.test(slug)) return "🧋";
  if (/mie|makan|nasi/.test(slug)) return "🍜";
  if (/roti|camilan/.test(slug)) return "🍞";
  return "🍽️";
}

/** Emoji cadangan produk (berdasarkan nama), jatuh ke emoji kategori. */
export function emojiForProduct(name: string, categorySlug: string): string {
  const n = name.toLowerCase();
  if (/nasi/.test(n)) return "🍳";
  if (/indomie|mie/.test(n)) return "🍜";
  if (/roti/.test(n)) return "🍞";
  if (/martabak/.test(n)) return "🥞";
  if (/pisang/.test(n)) return "🍌";
  if (/jeruk/.test(n)) return "🍊";
  if (/milo|soda|badak/.test(n)) return "🥤";
  if (/teh/.test(n)) return "🫖";
  if (/es /.test(n)) return "🧊";
  if (/kopi|sanger/.test(n)) return "☕";
  return emojiForCategory(categorySlug);
}
