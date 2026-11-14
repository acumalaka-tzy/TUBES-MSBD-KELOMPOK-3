/**
 * Data katalog Warkop Agam Medan — Jl. Berdikari Baru No. 21 B, Padang Bulan
 * (selaras dengan `prisma/seed.ts` & skema MySQL 17 tabel di PRD).
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
  /** Path foto di folder public/ (cth: /images/menu/prd-sanger-01.jpg) */
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
    name: "Kopi, TST & Racikan Susu",
    description:
      "Kopi Hitam, Kopi Sanger aneka rasa, TST ayam/bebek, Cappucino, Chocolatos, hingga Wedang Jahe Sereh.",
    emoji: "☕",
  },
  {
    id: "cat-dingin-02",
    slug: "minuman-dingin-segar",
    name: "Es Segar, Teh & Aneka Jus",
    description:
      "Teh Tarik, Thai Tea, Green Tea Latte, Milo, Soda Badak, Lemon Tea, serta Aneka Jus Buah segar.",
    emoji: "🧋",
  },
  {
    id: "cat-mie-03",
    slug: "mie-makanan-berat",
    name: "Mie, Nasi & Lauk Berat",
    description:
      "Indomie Bangladesh, Mie Aceh, Ifumie, Miehun, Mie Tiaw, Nasi Goreng, Ayam Penyet, Lele & Tumis Kangkung.",
    emoji: "🍜",
  },
  {
    id: "cat-camilan-04",
    slug: "roti-bakar-camilan",
    name: "Roti Cane, Martabak & Camilan",
    description:
      "Roti Cane aneka topping, Mami (Martabak Mie), Martabak Telur, Mix Platter, Piscok & Gorengan.",
    emoji: "🫓",
  },
];

const optManis: OptionGroup = {
  id: "og-gula",
  name: "Tingkat Manis",
  type: "single",
  required: true,
  items: [
    { id: "oi-mn-n", name: "Manis Normal", price: 0 },
    { id: "oi-mn-l", name: "Kurang Manis", price: 0 },
  ],
};

const optPedas: OptionGroup = {
  id: "og-pedas",
  name: "Level Pedas",
  type: "single",
  required: true,
  items: [
    { id: "oi-pd-s", name: "Pedas Sedang", price: 0 },
    { id: "oi-pd-e", name: "Pedas Ekstra", price: 0 },
    { id: "oi-pd-t", name: "Tidak Pedas", price: 0 },
  ],
};

const optMasakMieAceh: OptionGroup = {
  id: "og-masak",
  name: "Cara Masak",
  type: "single",
  required: true,
  items: [
    { id: "oi-ma-b", name: "Basah (Nyemek)", price: 0 },
    { id: "oi-ma-g", name: "Goreng", price: 0 },
    { id: "oi-ma-k", name: "Kuah", price: 0 },
  ],
};

function singleVariantGroup(
  id: string,
  name: string,
  variants: Array<[string, number]>,
  prefix = "oi-v",
): OptionGroup {
  return {
    id,
    name,
    type: "single",
    required: true,
    items: variants.map(([label, price], idx) => ({
      id: `${prefix}${idx + 1}`,
      name: label,
      price,
    })),
  };
}

const productList: Array<Omit<Product, "categoryName">> = [
  // =========================================================
  // 1. KOPI, TST & RACIKAN SUSU (cat-kopi-01)
  // =========================================================
  {
    id: "prd-sanger-01",
    categoryId: "cat-kopi-01",
    name: "Kopi Sanger",
    description:
      "Kopi saring khas Aceh dengan susu kental manis — tersedia Panas, Gelas Besar, Dingin, Bungkus, Jelly, serta varian Oreo, Chocolatos & Milo.",
    basePrice: 12000,
    emoji: "☕",
    imageUrl: "/images/menu/prd-sanger-01.jpg",
    availableQty: 45,
    minThreshold: 8,
    popularity: 100,
    bestSeller: true,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Gelas Besar", 1000],
        ["Dingin (Es)", 2000],
        ["Chocolatos Panas", 2000],
        ["Milo Panas", 2000],
        ["Oreo Panas", 3000],
        ["Bungkus", 3000],
        ["Dingin Oreo", 3000],
        ["Dingin Chocolatos", 3000],
        ["Dingin Milo", 3000],
        ["Jelly Dingin", 4000],
      ]),
      optManis,
    ],
  },
  {
    id: "prd-kopihitam-03",
    categoryId: "cat-kopi-01",
    name: "Kopi Hitam",
    description:
      "Seduhan kopi hitam pekat racikan Warkop Agam Medan, mantap disajikan panas, dingin, gelas besar, maupun bungkus.",
    basePrice: 8000,
    emoji: "☕",
    imageUrl: "/images/menu/prd-kopihitam-03.jpg",
    availableQty: 50,
    minThreshold: 8,
    popularity: 92,
    options: [
      singleVariantGroup("og-suhu", "Ukuran & Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
        ["Gelas Besar", 2000],
        ["Bungkus", 5000],
        ["Jelly Dingin", 6000],
      ]),
      optManis,
    ],
  },
  {
    id: "prd-kopijoss-09",
    categoryId: "cat-kopi-01",
    name: "Kopi Susu",
    description:
      "Perpaduan kopi saring warkop dengan susu creamy seimbang, nikmat diseruput hangat maupun dingin dengan es.",
    basePrice: 12000,
    emoji: "☕",
    imageUrl: "/images/menu/prd-kopijoss-09.jpg",
    availableQty: 40,
    minThreshold: 6,
    popularity: 90,
    options: [
      singleVariantGroup("og-suhu", "Suhu Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
      ]),
      optManis,
    ],
  },
  {
    id: "prd-tst",
    categoryId: "cat-kopi-01",
    name: "TST (Teh Susu Telur)",
    description:
      "Ikon stamina Warkop Agam Medan: kocokan kuning telur ayam kampung atau bebek dengan teh kental & susu hangat atau es.",
    basePrice: 16000,
    emoji: "🥚",
    imageUrl: "/images/menu/prd-tst.jpg",
    availableQty: 32,
    minThreshold: 6,
    popularity: 98,
    bestSeller: true,
    options: [
      singleVariantGroup("og-suhu", "Varian Telur & Penyajian", [
        ["TST Ayam (Panas)", 0],
        ["TST + Es (Dingin)", 0],
        ["TST Bebek", 1000],
        ["TST Ayam Teh Hijau", 1000],
        ["TST Bebek Teh Hijau", 2000],
      ]),
    ],
  },
  {
    id: "prd-kopikocok",
    categoryId: "cat-kopi-01",
    name: "Kopi Kocok Telur",
    description:
      "Kopi panas pekat dikocok bersama kuning telur hingga berbusa lembut, penambah tenaga favorit nongkrong malam.",
    basePrice: 18000,
    emoji: "☕",
    imageUrl: "/images/menu/prd-kopikocok.jpg",
    availableQty: 25,
    minThreshold: 5,
    popularity: 83,
    options: [optManis],
  },
  {
    id: "prd-capp",
    categoryId: "cat-kopi-01",
    name: "Cappucino",
    description:
      "Racikan cappucino lembut ala warkop dengan pilihan polos, tambah susu, dingin, blended es, atau topping jelly.",
    basePrice: 11000,
    emoji: "☕",
    imageUrl: "/images/menu/prd-capp.jpg",
    availableQty: 38,
    minThreshold: 6,
    popularity: 88,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Susu Panas", 1000],
        ["Dingin (Es)", 2000],
        ["Susu Dingin", 3000],
        ["Blended Dingin", 4000],
        ["Jelly Dingin", 4000],
      ]),
    ],
  },
  {
    id: "prd-choco",
    categoryId: "cat-kopi-01",
    name: "Chocolatos",
    description:
      "Minuman cokelat Italia pekat dan creamy, tersedia versi hangat menenangkan atau dingin menyegarkan.",
    basePrice: 11000,
    emoji: "🍫",
    imageUrl: "/images/menu/prd-choco.jpg",
    availableQty: 35,
    minThreshold: 6,
    popularity: 84,
    options: [
      singleVariantGroup("og-suhu", "Suhu Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
      ]),
    ],
  },
  {
    id: "prd-matcha",
    categoryId: "cat-kopi-01",
    name: "Matcha Chocolatos",
    description:
      "Paduan matcha creamy dengan sentuhan cokelat putih yang lembut, bisa dipilih Panas, Dingin, atau Blend.",
    basePrice: 12000,
    emoji: "🍵",
    imageUrl: "/images/menu/prd-matcha.jpg",
    availableQty: 30,
    minThreshold: 6,
    popularity: 85,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 3000],
        ["Blend Dingin", 3000],
      ]),
    ],
  },
  {
    id: "prd-susu",
    categoryId: "cat-kopi-01",
    name: "Susu Putih & Susu Coklat",
    description:
      "Susu segar manis hangat maupun dingin dengan pilihan rasa Susu Putih atau Susu Coklat klasik.",
    basePrice: 10000,
    emoji: "🥛",
    imageUrl: "/images/menu/prd-susu.jpg",
    availableQty: 36,
    minThreshold: 6,
    popularity: 78,
    options: [
      singleVariantGroup("og-suhu", "Rasa & Penyajian", [
        ["Susu Putih Panas", 0],
        ["Susu Coklat Panas", 2000],
        ["Susu Putih Dingin", 3000],
        ["Susu Coklat Dingin", 4000],
      ]),
    ],
  },
  {
    id: "prd-bangbang",
    categoryId: "cat-kopi-01",
    name: "Bang - Bang Drink",
    description:
      "Minuman karamel cokelat malt manis gurih favorit anak nongkrong, pas diminum panas maupun dingin.",
    basePrice: 11000,
    emoji: "🥤",
    imageUrl: "/images/menu/prd-bangbang.jpg",
    availableQty: 28,
    minThreshold: 5,
    popularity: 77,
    options: [
      singleVariantGroup("og-suhu", "Suhu Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
      ]),
    ],
  },
  {
    id: "prd-jahe",
    categoryId: "cat-kopi-01",
    name: "Wedang Jahe Sereh",
    description:
      "Seduhan jahe hangat beraroma sereh alami yang menghangatkan badan di segala suasana malam Medan.",
    basePrice: 12000,
    emoji: "🫖",
    imageUrl: "/images/menu/prd-jahe.jpg",
    availableQty: 30,
    minThreshold: 5,
    popularity: 80,
    options: [optManis],
  },

  // =========================================================
  // 2. ES SEGAR, TEH & ANEKA JUS (cat-dingin-02)
  // =========================================================
  {
    id: "prd-tehtarik-02",
    categoryId: "cat-dingin-02",
    name: "Teh Tarik",
    description:
      "Teh hitam pekat ditarik dengan susu hingga berbusa tebal — pilihan Susu Panas, Susu Dingin, atau Jelly Dingin.",
    basePrice: 12000,
    emoji: "🧋",
    imageUrl: "/images/menu/prd-tehtarik-02.jpg",
    availableQty: 42,
    minThreshold: 8,
    popularity: 95,
    bestSeller: true,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Susu Panas", 0],
        ["Susu Dingin (Es)", 2000],
        ["Jelly Dingin", 3000],
      ]),
    ],
  },
  {
    id: "prd-badak-05",
    categoryId: "cat-dingin-02",
    name: "Soda Badak",
    description:
      "Legenda sarsaparila Siantar khas Sumatra Utara dengan es batu dingin atau racikan Badak + Susu + Es (Soda Gembira).",
    basePrice: 12000,
    emoji: "🥤",
    imageUrl: "/images/menu/prd-badak-05.png",
    availableQty: 36,
    minThreshold: 6,
    popularity: 93,
    bestSeller: true,
    options: [
      singleVariantGroup("og-suhu", "Varian Sajian", [
        ["Badak + Es (Dingin)", 0],
        ["Badak + Susu + Es (Dingin)", 3000],
      ]),
    ],
  },
  {
    id: "prd-milo-04",
    categoryId: "cat-dingin-02",
    name: "Milo",
    description:
      "Milo cokelat malt kental racikan warkop: mulai dari Panas, Dingin, Susu, Double, Jelly Dingin, hingga Milo Blended.",
    basePrice: 11000,
    emoji: "🥤",
    imageUrl: "/images/menu/prd-milo-04.jpg",
    availableQty: 40,
    minThreshold: 8,
    popularity: 91,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Susu Panas", 1000],
        ["Dingin (Es)", 2000],
        ["Double", 3000],
        ["Jelly Dingin", 3000],
        ["Susu Dingin", 4000],
        ["Blended Dingin", 4000],
      ]),
    ],
  },
  {
    id: "prd-thaitea",
    categoryId: "cat-dingin-02",
    name: "Thai Tea Susu",
    description:
      "Teh Thailand aromatik bercampur susu kental manis, segar dinikmati Panas, Dingin, atau tambah Jelly.",
    basePrice: 13000,
    emoji: "🧋",
    imageUrl: "/images/menu/prd-thaitea.png",
    availableQty: 32,
    minThreshold: 6,
    popularity: 87,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
        ["Jelly Dingin", 3000],
      ]),
    ],
  },
  {
    id: "prd-greentea",
    categoryId: "cat-dingin-02",
    name: "Green Tea Latte",
    description:
      "Latte teh hijau wangi dan lembut, tersedia Green Tea Latte Panas, Dingin, serta Jelly Dingin.",
    basePrice: 13000,
    emoji: "🍵",
    imageUrl: "/images/menu/prd-greentea.jpg",
    availableQty: 30,
    minThreshold: 6,
    popularity: 86,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
        ["Jelly Dingin", 3000],
      ]),
    ],
  },
  {
    id: "prd-tehhijau",
    categoryId: "cat-dingin-02",
    name: "Teh Hijau",
    description:
      "Seduhan teh hijau wangi yang ringan dan menyegarkan — Panas, Dingin, Jelly Dingin, atau Blended.",
    basePrice: 8000,
    emoji: "🍵",
    imageUrl: "/images/menu/prd-tehhijau.jpg",
    availableQty: 34,
    minThreshold: 6,
    popularity: 80,
    options: [
      singleVariantGroup("og-suhu", "Varian & Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
        ["Jelly Dingin", 5000],
        ["Blended Dingin", 7000],
      ]),
    ],
  },
  {
    id: "prd-tehmanis",
    categoryId: "cat-dingin-02",
    name: "Teh Manis & Teh Tawar",
    description:
      "Minuman wajib pendamping makan: Teh Tawar, Teh Manis Hangat, Teh Manis Dingin, dan ukuran Jumbo.",
    basePrice: 5000,
    emoji: "🧊",
    imageUrl: "/images/menu/prd-tehmanis.jpg",
    availableQty: 60,
    minThreshold: 10,
    popularity: 92,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Teh", [
        ["Teh Tawar", 0],
        ["Teh Manis Hangat", 1000],
        ["Teh Manis Dingin", 2000],
        ["Teh Manis Dingin Jumbo", 5000],
      ]),
    ],
  },
  {
    id: "prd-lemon",
    categoryId: "cat-dingin-02",
    name: "Lemon & Lemon Tea",
    description:
      "Perasan lemon segar atau paduan Lemon Tea nikmat, bisa dipilih versi Panas maupun Dingin (Es).",
    basePrice: 10000,
    emoji: "🍋",
    imageUrl: "/images/menu/prd-lemontea.jpg",
    availableQty: 35,
    minThreshold: 6,
    popularity: 82,
    options: [
      singleVariantGroup("og-suhu", "Varian & Suhu", [
        ["Lemon Panas", 0],
        ["Lemon Tea Panas", 1000],
        ["Lemon Dingin (Es)", 2000],
        ["Lemon Tea Dingin (Es)", 3000],
      ]),
    ],
  },
  {
    id: "prd-jeruk-10",
    categoryId: "cat-dingin-02",
    name: "Jeruk Peras",
    description:
      "Perasan jeruk asli tanpa pemanis buatan, kaya vitamin C dan menyegarkan tenggorokan.",
    basePrice: 16000,
    emoji: "🍊",
    imageUrl: "/images/menu/prd-jeruk-10.jpg",
    availableQty: 30,
    minThreshold: 6,
    popularity: 84,
    options: [
      singleVariantGroup("og-suhu", "Suhu Penyajian", [
        ["Dingin (Es)", 0],
        ["Hangat", 0],
      ]),
    ],
  },
  {
    id: "prd-nutrisari",
    categoryId: "cat-dingin-02",
    name: "Nutrisari Jeruk",
    description:
      "Minuman jeruk segar praktis ala warkop dengan pilihan sajian Panas atau Dingin (Es).",
    basePrice: 8000,
    emoji: "🍊",
    imageUrl: "/images/menu/prd-nutrisari.jpg",
    availableQty: 40,
    minThreshold: 6,
    popularity: 76,
    options: [
      singleVariantGroup("og-suhu", "Suhu Penyajian", [
        ["Panas", 0],
        ["Dingin (Es)", 2000],
      ]),
    ],
  },
  {
    id: "prd-kuku",
    categoryId: "cat-dingin-02",
    name: "Kukubima",
    description:
      "Minuman penyegar stamina Kukubima dingin dengan es batu segar yang menyegarkan.",
    basePrice: 10000,
    emoji: "⚡",
    imageUrl: "/images/menu/prd-kuku.jpg",
    availableQty: 40,
    minThreshold: 6,
    popularity: 80,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Racikan", [
        ["Kukubima Dingin", 0],
      ]),
    ],
  },
  {
    id: "prd-kuku-susu",
    categoryId: "cat-dingin-02",
    name: "Kukubima Susu",
    description:
      "Racikan Kukubima dingin dipadukan dengan susu kental manis yang creamy dan menyegarkan.",
    basePrice: 13000,
    emoji: "⚡",
    imageUrl: "/images/menu/prd-kuku-susu.png",
    availableQty: 40,
    minThreshold: 6,
    popularity: 81,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Racikan", [
        ["Kukubima Susu Dingin", 0],
      ]),
    ],
  },
  {
    id: "prd-extrajoss",
    categoryId: "cat-dingin-02",
    name: "Extra Joss",
    description:
      "Minuman penyegar energi Extra Joss dingin dengan es batu segar yang menyegarkan.",
    basePrice: 10000,
    emoji: "⚡",
    imageUrl: "/images/menu/prd-extrajoss.jpg",
    availableQty: 40,
    minThreshold: 6,
    popularity: 80,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Racikan", [
        ["Extra Joss Dingin", 0],
      ]),
    ],
  },
  {
    id: "prd-extrajoss-susu",
    categoryId: "cat-dingin-02",
    name: "Extra Joss Susu",
    description:
      "Racikan Extra Joss dingin dipadukan dengan susu kental manis yang creamy dan segar.",
    basePrice: 13000,
    emoji: "⚡",
    imageUrl: "/images/menu/prd-extrajoss-susu.jpg",
    availableQty: 40,
    minThreshold: 6,
    popularity: 81,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Racikan", [
        ["Extra Joss Susu Dingin", 0],
      ]),
    ],
  },
  {
    id: "prd-amoz",
    categoryId: "cat-dingin-02",
    name: "Amoz & Es Kosong",
    description:
      "Pilihan air mineral Amoz (suhu ruang atau dengan es batu) serta gelas Es Kosong penyegar.",
    basePrice: 3000,
    emoji: "🧊",
    imageUrl: "/images/menu/prd-tehmanis.jpg",
    availableQty: 80,
    minThreshold: 10,
    popularity: 72,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Sajian", [
        ["Es Kosong (Dingin)", 0],
        ["Amoz", 2000],
        ["Amoz + Es (Dingin)", 3000],
      ]),
    ],
  },
  {
    id: "prd-jusmartabe",
    categoryId: "cat-dingin-02",
    name: "Jus Martabe",
    description:
      "Jus perpaduan ikonik khas Medan antara markisah wangi dan terong belanda asam-manis yang menyegarkan.",
    basePrice: 17000,
    emoji: "🧃",
    imageUrl: "/images/menu/prd-jusmartabe.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 91,
    options: [optManis],
  },
  {
    id: "prd-jusmarkisa",
    categoryId: "cat-dingin-02",
    name: "Jus Markisah",
    description:
      "Jus buah markisah khas Brastagi dengan aroma asam-manis alami menyegarkan tenggorokan.",
    basePrice: 16000,
    emoji: "🍹",
    imageUrl: "/images/menu/prd-jusmarkisa.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 88,
    options: [optManis],
  },
  {
    id: "prd-jusguava",
    categoryId: "cat-dingin-02",
    name: "Jus Guava",
    description:
      "Jus jambu biji merah pilihan bertekstur kental lembut, kaya vitamin C dan manis alami.",
    basePrice: 17000,
    emoji: "🥤",
    imageUrl: "/images/menu/prd-jusguava.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 87,
    options: [optManis],
  },
  {
    id: "prd-justerong",
    categoryId: "cat-dingin-02",
    name: "Jus Terong Belanda",
    description:
      "Jus terong belanda segar khas Sumatra Utara dengan warna merah pekat dan cita rasa asam-manis nikmat.",
    basePrice: 16000,
    emoji: "🫐",
    imageUrl: "/images/menu/prd-justerong.jpg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 84,
    options: [optManis],
  },
  {
    id: "prd-jusalp",
    categoryId: "cat-dingin-02",
    name: "Jus Alpukat",
    description:
      "Alpukat mentega diblender halus dan kental dengan kucuran susu kental manis cokelat.",
    basePrice: 16000,
    emoji: "🥑",
    imageUrl: "/images/menu/prd-jusalp.jpg",
    availableQty: 28,
    minThreshold: 5,
    popularity: 89,
    options: [
      singleVariantGroup("og-suhu", "Sajian", [
        ["Dingin + Susu Coklat", 0],
        ["Dingin Tanpa Susu Coklat", 0],
      ]),
    ],
  },
  {
    id: "prd-jusmangga",
    categoryId: "cat-dingin-02",
    name: "Jus Mangga",
    description:
      "Jus mangga harum manis pilihan diblender dingin bertekstur lembut dan manis menyegarkan.",
    basePrice: 16000,
    emoji: "🥭",
    imageUrl: "/images/menu/prd-jusmangga.png",
    availableQty: 28,
    minThreshold: 5,
    popularity: 87,
    options: [optManis],
  },
  {
    id: "prd-jusjeruk",
    categoryId: "cat-dingin-02",
    name: "Jus Jeruk",
    description:
      "Jus jeruk segar dingin diblender bersama es batu, kaya kesegaran buah jeruk manis.",
    basePrice: 16000,
    emoji: "🍊",
    imageUrl: "/images/menu/prd-jusjeruk.jpg",
    availableQty: 28,
    minThreshold: 5,
    popularity: 85,
    options: [optManis],
  },
  {
    id: "prd-jussirsak",
    categoryId: "cat-dingin-02",
    name: "Jus Sirsak",
    description:
      "Jus buah sirsak segar lembut bercita rasa manis-asam khas tropis.",
    basePrice: 16000,
    emoji: "🥛",
    imageUrl: "/images/menu/prd-jussirsak.jpg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 84,
    options: [optManis],
  },
  {
    id: "prd-jusblimbing",
    categoryId: "cat-dingin-02",
    name: "Jus Belimbing",
    description:
      "Jus belimbing segar yang ringan, renyah di tenggorokan, dan pas diminum dingin.",
    basePrice: 16000,
    emoji: "⭐",
    imageUrl: "/images/menu/prd-jusblimbing.jpg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 80,
    options: [optManis],
  },
  {
    id: "prd-jusnaga",
    categoryId: "cat-dingin-02",
    name: "Jus Naga",
    description:
      "Jus buah naga merah pekat tinggi serat dan menyegarkan untuk menemani nongkrong.",
    basePrice: 16000,
    emoji: "🐉",
    imageUrl: "/images/menu/prd-jusnaga.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 84,
    options: [optManis],
  },
  {
    id: "prd-jussemangka",
    categoryId: "cat-dingin-02",
    name: "Jus Semangka",
    description:
      "Jus buah semangka merah dingin yang manis berair dan cepat melepas dahaga.",
    basePrice: 16000,
    emoji: "🍉",
    imageUrl: "/images/menu/prd-jussemangka.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 82,
    options: [optManis],
  },
  {
    id: "prd-justimun",
    categoryId: "cat-dingin-02",
    name: "Jus Timun & Timun Serut",
    description:
      "Minuman dingin menyegarkan khas Aceh: pilih Jus Timun segar atau Es Timun Serut dengan selasih.",
    basePrice: 16000,
    emoji: "🥒",
    imageUrl: "/images/menu/prd-justimun.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 81,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Sajian", [
        ["Jus Timun", 0],
        ["Timun Serut", 0],
      ]),
      optManis,
    ],
  },
  {
    id: "prd-juswortel",
    categoryId: "cat-dingin-02",
    name: "Jus Wortel",
    description:
      "Jus wortel segar bernutrisi — pilih Jus Wortel murni atau tambah Susu kental manis.",
    basePrice: 16000,
    emoji: "🥕",
    imageUrl: "/images/menu/prd-juswortel.jpg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 78,
    options: [
      singleVariantGroup("og-suhu", "Pilihan Varian", [
        ["Jus Wortel", 0],
        ["Jus Wortel + Susu", 2000],
      ]),
      optManis,
    ],
  },
  {
    id: "prd-juswortel-jeruk",
    categoryId: "cat-dingin-02",
    name: "Jus Wortel + Jeruk",
    description:
      "Perpaduan segar jus wortel manis dengan perasan jeruk kaya vitamin C, nikmat diminum dingin.",
    basePrice: 16000,
    emoji: "🥕",
    imageUrl: "/images/menu/prd-juswortel-jeruk.jpg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 79,
    options: [optManis],
  },
  {
    id: "prd-jussawi",
    categoryId: "cat-dingin-02",
    name: "Jus Sawi + Nenas",
    description:
      "Jus hijau menyehatkan perpaduan sawi segar dan nanas manis-asam tanpa bau langu.",
    basePrice: 17000,
    emoji: "🥬",
    imageUrl: "/images/menu/prd-jussawi.jpg",
    availableQty: 24,
    minThreshold: 5,
    popularity: 77,
    options: [optManis],
  },

  // =========================================================
  // 3. MIE, NASI & LAUK BERAT (cat-mie-03)
  // =========================================================
  {
    id: "prd-bangladesh-06",
    categoryId: "cat-mie-03",
    name: "Indomie Bangladesh",
    description:
      "Menu andalan Warkop Agam: Indomie bumbu rempah khas Medan yang gurih berkaldu, dengan pilihan Puding Ayam atau porsi Jumbo.",
    basePrice: 15000,
    emoji: "🍜",
    imageUrl: "/images/menu/prd-bangladesh-06.jpg",
    availableQty: 40,
    minThreshold: 6,
    popularity: 99,
    bestSeller: true,
    options: [
      singleVariantGroup("og-porsi", "Pilihan Porsi & Puding", [
        ["Bangladesh Biasa", 0],
        ["Bangladesh Puding Ayam", 5000],
        ["Bangladesh Jumbo", 5000],
        ["Bangladesh Jumbo + Puding Ayam", 11000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-mieaceh-11",
    categoryId: "cat-mie-03",
    name: "Mie Aceh",
    description:
      "Mie kuning kenyal dengan bumbu rempah kari Aceh pekat — pilih Goreng, Basah (Nyemek), atau Kuah serta isian favorit.",
    basePrice: 15000,
    emoji: "🍜",
    imageUrl: "/images/menu/prd-mieaceh-11.jpg",
    availableQty: 32,
    minThreshold: 5,
    popularity: 97,
    bestSeller: true,
    options: [
      optMasakMieAceh,
      singleVariantGroup("og-isian", "Pilihan Topping / Lauk", [
        ["Mie Aceh Biasa", 0],
        ["Telur Campur", 5000],
        ["Telur Dadar", 5000],
        ["Telur Mata Sapi", 5000],
        ["Ayam", 10000],
        ["Daging", 12000],
        ["Udang", 12000],
        ["Cumi", 12000],
        ["Spesial (Udang + Daging)", 17000],
        ["Spesial (Udang + Cumi)", 17000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-nasgor-07",
    categoryId: "cat-mie-03",
    name: "Nasi Goreng",
    description:
      "Nasi goreng wajan api besar bumbu warkop Medan: varian Biasa, Bangladesh, Jumbo, Ayam, Udang, Cumi, hingga Seafood.",
    basePrice: 16000,
    emoji: "🍳",
    imageUrl: "/images/menu/prd-nasgor-07.jpg",
    availableQty: 34,
    minThreshold: 6,
    popularity: 94,
    bestSeller: true,
    options: [
      singleVariantGroup("og-isian", "Pilihan Varian", [
        ["Nasi Goreng Biasa", 0],
        ["Nasi Goreng Bangladesh", 0],
        ["Nasi Goreng Jumbo", 3000],
        ["Nasi Goreng Ayam", 8000],
        ["Nasi Goreng Udang", 10000],
        ["Nasi Goreng Cumi", 11000],
        ["Seafood Nasi Goreng Seat", 12000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-indogoreng",
    categoryId: "cat-mie-03",
    name: "Indomie Goreng & Bumbu Aceh",
    description:
      "Indomie Goreng Biasa, Ori, maupun racikan Bumbu Aceh warkop, tersedia ukuran Jumbo dan tambahan Puding Ayam.",
    basePrice: 15000,
    emoji: "🍜",
    imageUrl: "/images/menu/prd-indogoreng.png",
    availableQty: 38,
    minThreshold: 6,
    popularity: 90,
    options: [
      singleVariantGroup("og-porsi", "Pilihan Varian & Porsi", [
        ["Indomie Goreng Biasa", 0],
        ["Indomie Goreng Ori", 0],
        ["Indomie Bumbu Aceh", 0],
        ["Indomie Goreng Jumbo", 5000],
        ["Indomie Goreng Ori Jumbo", 5000],
        ["Indomie Goreng Puding Ayam", 5000],
        ["Indomie Goreng Jumbo + Puding Ayam", 11000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-indokuah",
    categoryId: "cat-mie-03",
    name: "Indomie Kuah",
    description:
      "Indomie rebus berkuah hangat mengepul — tersedia Biasa, Ori, Jumbo, dan paduan Puding Telur Ayam kampung.",
    basePrice: 13000,
    emoji: "🍲",
    imageUrl: "/images/menu/prd-indomiekuah.jpg",
    availableQty: 38,
    minThreshold: 6,
    popularity: 88,
    options: [
      singleVariantGroup("og-porsi", "Pilihan Varian & Porsi", [
        ["Indomie Kuah Biasa", 0],
        ["Indomie Kuah Ori", 0],
        ["Indomie Kuah Jumbo", 5000],
        ["Indomie Kuah Ori Jumbo", 5000],
        ["Indomie Kuah + Puding Ayam", 5000],
        ["Indomie Kuah Jumbo + Puding Ayam", 11000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-ifumie",
    categoryId: "cat-mie-03",
    name: "Ifumie",
    description:
      "Mie kering renyah disiram kuah kental atau tumisan goreng gurih dengan topping Biasa, Udang, Cumi, atau Seafood.",
    basePrice: 15000,
    emoji: "🍜",
    imageUrl: "/images/menu/prd-ifumie.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 87,
    options: [
      singleVariantGroup("og-isian", "Pilihan Cara Masak & Lauk", [
        ["Ifumie Goreng Biasa", 0],
        ["Ifumie Kuah Biasa", 0],
        ["Ifumie Goreng Udang", 10000],
        ["Ifumie Kuah Udang", 11000],
        ["Ifumie Goreng Cumi", 11000],
        ["Ifumie Kuah Cumi", 11000],
        ["Ifumie Seafood", 12000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-miehun",
    categoryId: "cat-mie-03",
    name: "Miehun (Bihun)",
    description:
      "Miehun / bihun lembut dimasak goreng atau berkuah kaldu dengan pilihan Biasa, Udang, Cumi, hingga Seafood.",
    basePrice: 15000,
    emoji: "🍜",
    imageUrl: "/images/menu/prd-miehun.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 84,
    options: [
      singleVariantGroup("og-isian", "Pilihan Varian", [
        ["Miehun Goreng Biasa", 0],
        ["Miehun Kuah Biasa", 0],
        ["Miehun Goreng Udang", 10000],
        ["Miehun Kuah Udang", 10000],
        ["Miehun Goreng Cumi", 11000],
        ["Miehun Kuah Seafood", 11000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-mietiaw",
    categoryId: "cat-mie-03",
    name: "Mie Tiaw Goreng",
    description:
      "Kwetiau lebar tumis wajan panas beraroma smokey — pilihan Biasa, Udang, Cumi, atau komplit Seafood.",
    basePrice: 15000,
    emoji: "🍜",
    imageUrl: "/images/menu/prd-mietiaw.jpg",
    availableQty: 26,
    minThreshold: 5,
    popularity: 85,
    options: [
      singleVariantGroup("og-isian", "Pilihan Topping", [
        ["Mie Tiaw Goreng Biasa", 0],
        ["Mie Tiaw Goreng Udang", 10000],
        ["Mie Tiaw Goreng Cumi", 11000],
        ["Mie Tiaw Goreng Seafood", 12000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-penyet",
    categoryId: "cat-mie-03",
    name: "Ayam Penyet",
    description:
      "Ayam goreng gurih dipenyet bersama sambal terasi pedas segar & lalapan, tersedia lauk saja atau paket dengan nasi hangat.",
    basePrice: 13000,
    emoji: "🍗",
    imageUrl: "/images/menu/prd-penyet.jpg",
    availableQty: 25,
    minThreshold: 5,
    popularity: 89,
    options: [
      singleVariantGroup("og-nasi", "Pilihan Paket", [
        ["Ayam Penyet (Tanpa Nasi)", 0],
        ["Ayam Penyet + Nasi", 6000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-nasi-penyet",
    categoryId: "cat-mie-03",
    name: "Nasi Ayam Penyet",
    description:
      "Paket lengkap ayam goreng penyet renyah dengan nasi putih hangat, tempe goreng, lalapan segar, dan sambal terasi pedas.",
    basePrice: 19000,
    emoji: "🍗",
    imageUrl: "/images/menu/prd-nasi-penyet.jpg",
    availableQty: 25,
    minThreshold: 5,
    popularity: 91,
    options: [optPedas],
  },
  {
    id: "prd-lele",
    categoryId: "cat-mie-03",
    name: "Ikan Lele Goreng",
    description:
      "Lele goreng garing renyah disajikan bersama sambal & lalapan segar, pilih lauk saja atau paket nasi putih.",
    basePrice: 10000,
    emoji: "🐟",
    imageUrl: "/images/menu/prd-lele.webp",
    availableQty: 24,
    minThreshold: 5,
    popularity: 82,
    options: [
      singleVariantGroup("og-nasi", "Pilihan Paket", [
        ["Ikan Lele Goreng (Tanpa Nasi)", 0],
        ["Ikan Lele Goreng + Nasi", 6000],
      ]),
    ],
  },
  {
    id: "prd-seafood",
    categoryId: "cat-mie-03",
    name: "Udang & Cumi Goreng",
    description:
      "Lauk seafood goreng garing berbumbu gurih — pilih seporsi Udang Goreng atau Cumi Goreng segar.",
    basePrice: 15000,
    emoji: "🍤",
    imageUrl: "/images/menu/prd-seafood.jpg",
    availableQty: 20,
    minThreshold: 4,
    popularity: 81,
    options: [
      singleVariantGroup("og-lauk", "Pilihan Lauk", [
        ["Udang Goreng", 0],
        ["Cumi Goreng", 0],
      ]),
    ],
  },
  {
    id: "prd-kangkung",
    categoryId: "cat-mie-03",
    name: "Tumis Kangkung",
    description:
      "Cah kangkung segar ditumis bawang putih saus tiram gurih, pilihan Tumis Kangkung Biasa atau Seafood.",
    basePrice: 12000,
    emoji: "🥬",
    imageUrl: "/images/menu/prd-kangkung.jpg",
    availableQty: 25,
    minThreshold: 5,
    popularity: 79,
    options: [
      singleVariantGroup("og-var", "Pilihan Varian", [
        ["Tumis Kangkung Biasa", 0],
        ["Tumis Kangkung Seafood", 8000],
      ]),
      optPedas,
    ],
  },
  {
    id: "prd-telur",
    categoryId: "cat-mie-03",
    name: "Nasi Putih & Aneka Telur",
    description:
      "Pelengkap menu makan: Telur Dadar/Mata Sapi, Nasi Putih hangat, serta paket Nasi + Telur.",
    basePrice: 5000,
    emoji: "🍳",
    imageUrl: "/images/menu/prd-telur.jpg",
    availableQty: 50,
    minThreshold: 8,
    popularity: 76,
    options: [
      singleVariantGroup("og-var", "Pilihan Menu", [
        ["Telur Dadar / Mata Sapi", 0],
        ["Nasi Putih", 1000],
        ["Nasi + Telur", 8000],
      ]),
    ],
  },
  {
    id: "prd-puding",
    categoryId: "cat-mie-03",
    name: "Puding Telur",
    description:
      "Telur setengah matang khas warkop (telur ayam kampung atau bebek) — disajikan hangat dengan lada & kecap asin.",
    basePrice: 6000,
    emoji: "🥚",
    imageUrl: "/images/menu/prd-puding.webp",
    availableQty: 30,
    minThreshold: 5,
    popularity: 80,
    options: [
      singleVariantGroup("og-var", "Pilihan Puding Telur", [
        ["Puding Telur Ayam", 0],
        ["Puding Telur Bebek", 2000],
        ["Puding 2 Telur Ayam", 6000],
        ["Puding 2 Telur Bebek", 10000],
      ]),
    ],
  },

  // =========================================================
  // 4. ROTI CANE, MARTABAK & CAMILAN (cat-camilan-04)
  // =========================================================
  {
    id: "prd-rotibakar-08",
    categoryId: "cat-camilan-04",
    name: "Roti Cane",
    description:
      "Roti cane tipis berlapis renyah panggang mentega dengan pilihan taburan Gula, Susu, Coklat, Keju, Pisang, komplit, atau Kuah Kari.",
    basePrice: 10000,
    emoji: "🫓",
    imageUrl: "/images/menu/prd-cane.webp",
    availableQty: 32,
    minThreshold: 6,
    popularity: 96,
    bestSeller: true,
    options: [
      singleVariantGroup("og-top", "Pilihan Rasa / Kuah", [
        ["Roti Cane Gula", 0],
        ["Roti Cane Susu", 3000],
        ["Roti Cane Coklat", 3000],
        ["Roti Cane Keju", 3000],
        ["Roti Cane Kari", 4000],
        ["Roti Cane Pisang", 4000],
        ["Roti Cane Coklat + Keju", 5000],
        ["Roti Cane Pisang + Coklat + Keju", 8000],
      ]),
    ],
  },
  {
    id: "prd-martabak-12",
    categoryId: "cat-camilan-04",
    name: "Martabak Telur & Mami",
    description:
      "Gorengan gurih renyah khas warkop: pilih Martabak Telur klasik atau Mami (Martabak Mie) lengkap dengan acar dan saus.",
    basePrice: 13000,
    emoji: "🥞",
    imageUrl: "/images/menu/prd-martabak-12.png",
    availableQty: 26,
    minThreshold: 5,
    popularity: 89,
    options: [
      singleVariantGroup("og-var", "Pilihan Menu", [
        ["Martabak Telur", 0],
        ["Mami (Martabak Mie)", 5000],
      ]),
    ],
  },
  {
    id: "prd-pisang-13",
    categoryId: "cat-camilan-04",
    name: "Piscok (Pisang Coklat)",
    description:
      "Gulungan kulit lumpia renyah berisi pisang manis dan cokelat lumer hangat — teman setia ngopi malam.",
    basePrice: 15000,
    emoji: "🍌",
    imageUrl: "/images/menu/prd-pisang-13.jpg",
    availableQty: 28,
    minThreshold: 5,
    popularity: 85,
    options: [],
  },
  {
    id: "prd-platter",
    categoryId: "cat-camilan-04",
    name: "Mix Platter & Gorengan",
    description:
      "Camilan renyah teman nongkrong: Kentang Goreng, Keripik Kentang Goreng, Sosis, Nuget, atau paket komplit Mix Platter.",
    basePrice: 13000,
    emoji: "🍟",
    imageUrl: "/images/menu/prd-platter.jpg",
    availableQty: 30,
    minThreshold: 5,
    popularity: 88,
    options: [
      singleVariantGroup("og-var", "Pilihan Camilan", [
        ["Kentang Goreng", 0],
        ["Keripik Kentang Goreng", 0],
        ["Sosis Goreng", 0],
        ["Nuget Goreng", 0],
        ["Mix Platter (Kentang, Nuget, Sosis)", 5000],
      ]),
    ],
  },
  {
    id: "prd-tempe",
    categoryId: "cat-camilan-04",
    name: "Tempe & Tahu Goreng",
    description:
      "Tempe goreng atau tahu goreng hangat bertepung tipis renyah lengkap dengan saus sambal.",
    basePrice: 13000,
    emoji: "🥢",
    imageUrl: "/images/menu/prd-tempe.jpg",
    availableQty: 30,
    minThreshold: 5,
    popularity: 77,
    options: [
      singleVariantGroup("og-var", "Pilihan Menu", [
        ["Tempe Goreng", 0],
        ["Tahu Goreng", 0],
      ]),
    ],
  },
];

export const sampleProducts: Product[] = productList.map((p, index) => ({
  ...p,
  sortOrder: index,
  categoryName: sampleCategories.find((c) => c.id === p.categoryId)?.name ?? "",
  imageUrl: p.imageUrl ?? `/images/menu/${p.id}.jpg`,
}));

export interface RestaurantInfo {
  name: string;
  address: string;
  /** Nomor WhatsApp format internasional tanpa +, cth: 6281361425142 */
  whatsapp: string;
  /** Teks jam operasional, cth: "Buka 24 Jam (Setiap Hari)" */
  openingHours: string;
  /** Saklar buka/tutup pemesanan web (restaurant_settings.is_web_ordering_open) */
  isWebOrderingOpen: boolean;
}

/** Selaras dengan `prisma/seed.ts` (RestaurantSetting). */
export const sampleRestaurant: RestaurantInfo = {
  name: "Warkop Agam",
  address: "Jalan Berdikari Baru 21, 20155 Padang Bulan, North Sumatra",
  whatsapp: "6281361425142",
  openingHours: "Buka 24 Jam (Setiap Hari)",
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
  if (/roti|camilan/.test(slug)) return "🫓";
  return "🍽️";
}

/** Emoji cadangan produk (berdasarkan nama), jatuh ke emoji kategori. */
export function emojiForProduct(name: string, categorySlug: string): string {
  const n = name.toLowerCase();
  if (/nasi/.test(n)) return "🍳";
  if (/indomie|mie|ifumie|bihun|tiaw/.test(n)) return "🍜";
  if (/cane|roti/.test(n)) return "🫓";
  if (/martabak|mami/.test(n)) return "🥞";
  if (/pisang|piscok/.test(n)) return "🍌";
  if (/jeruk|lemon|nutrisari/.test(n)) return "🍊";
  if (/jus|martabe|alpukat|mangga|naga/.test(n)) return "🧃";
  if (/milo|soda|badak|thai|matcha|green tea|capp|choco|bang/.test(n)) return "🥤";
  if (/teh|jahe/.test(n)) return "🫖";
  if (/ayam|penyet/.test(n)) return "🍗";
  if (/lele/.test(n)) return "🐟";
  if (/udang|cumi/.test(n)) return "🍤";
  if (/kangkung/.test(n)) return "🥬";
  if (/platter|kentang/.test(n)) return "🍟";
  if (/es |amoz/.test(n)) return "🧊";
  if (/kopi|sanger|tst/.test(n)) return "☕";
  return emojiForCategory(categorySlug);
}
