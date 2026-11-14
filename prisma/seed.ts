import "dotenv/config";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  sampleCategories,
  sampleProducts,
  sampleRestaurant,
} from "../src/lib/menu-data";
import { INITIAL_MOCK_USERS } from "../src/lib/auth/mock-users";

const prisma = new PrismaClient();

const RESTAURANT_SETTING_ID = "set-main-001";
const TAX_PERCENTAGE = 0;

const TOTAL_TABLES = 40;

type SeedTableSpec = {
  id: string;
  table_number: string;
  name: string;
  capacity: number;
  qr_token: string;
};

const INITIAL_SEED_TABLES: readonly SeedTableSpec[] = [
  {
    id: "tbl-01",
    table_number: "01",
    name: "Meja 1",
    capacity: 4,
    qr_token: "qr_tok_agam_m01_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c",
  },
  {
    id: "tbl-02",
    table_number: "02",
    name: "Meja 2",
    capacity: 4,
    qr_token: "qr_tok_agam_m02_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  },
  {
    id: "tbl-03",
    table_number: "03",
    name: "Meja 3",
    capacity: 2,
    qr_token: "qr_tok_agam_m03_7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
  },
  {
    id: "tbl-04",
    table_number: "04",
    name: "Meja 4",
    capacity: 4,
    qr_token: "qr_tok_agam_m04_4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
  },
  {
    id: "tbl-05",
    table_number: "05",
    name: "Meja 5",
    capacity: 6,
    qr_token: "qr_tok_agam_m05_2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f",
  },
  {
    id: "tbl-06",
    table_number: "06",
    name: "Meja 6",
    capacity: 8,
    qr_token: "qr_tok_agam_m06_8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
  },
];

/** Builds table seed specs up to `total`, keeping initial tables & QR tokens intact. */
function buildSeedTables(total: number): SeedTableSpec[] {
  return Array.from({ length: total }, (_, index) => {
    const existing = INITIAL_SEED_TABLES[index];
    if (existing) return existing;

    const num = index + 1;
    const padded = String(num).padStart(2, "0");
    const tokenDigest = createHash("sha256")
      .update(`warkop-agam-table-${padded}`)
      .digest("hex")
      .slice(0, 32);

    return {
      id: `tbl-${padded}`,
      table_number: padded,
      name: `Meja ${num}`,
      capacity: num % 10 === 0 ? 8 : num % 5 === 0 ? 6 : num % 4 === 0 ? 2 : 4,
      qr_token: `qr_tok_agam_m${padded}_${tokenDigest}`,
    };
  });
}

const SEED_TABLES = buildSeedTables(TOTAL_TABLES);

type SeedOrderSpec = {
  id: string;
  orderNumber: string;
  trackingToken: string;
  daysAgo: number;
  hoursOffset: number;
  userId?: string;
  tableId?: string;
  customerName: string;
  customerPhone: string;
  source: "WEB" | "POS";
  serviceType: "DINE_IN" | "TAKEAWAY";
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "COMPLETED"
    | "CANCELLED";
  paymentMethod: "CASH" | "QRIS" | "VIRTUAL_ACCOUNT";
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
  cashierId?: string;
  refundReason?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    options?: Array<{
      groupName: string;
      optionName: string;
      priceAdjustment: number;
    }>;
    notes?: string;
  }>;
};

function buildHistoricalOrderSpecs(): SeedOrderSpec[] {
  return [
    {
      id: "ord-seed-001",
      orderNumber: "ORD-20261114-001",
      trackingToken: "trk_seed_001_agam_active",
      daysAgo: 0,
      hoursOffset: 1,
      userId: "usr-cust-001",
      tableId: "tbl-01",
      customerName: "Andi Saputra",
      customerPhone: "085270002001",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "PREPARING",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      notes: "Tolong kopi jangan terlalu manis",
      items: [
        {
          productId: "prd-sanger-01",
          quantity: 2,
          options: [
            { groupName: "Suhu Penyajian", optionName: "Dingin (Es)", priceAdjustment: 2000 },
            { groupName: "Tingkat Manis", optionName: "Manis Normal", priceAdjustment: 0 },
          ],
        },
        {
          productId: "prd-bangladesh-06",
          quantity: 1,
          options: [
            { groupName: "Cara Masak", optionName: "Nyemek (Becek)", priceAdjustment: 0 },
            { groupName: "Level Pedas", optionName: "Pedas Sedang", priceAdjustment: 0 },
            { groupName: "Tambahan Topping", optionName: "Telur 1/2 Matang", priceAdjustment: 4000 },
          ],
        },
      ],
    },
    {
      id: "ord-seed-002",
      orderNumber: "ORD-20261114-002",
      trackingToken: "trk_seed_002_agam_done",
      daysAgo: 0,
      hoursOffset: 3,
      tableId: "tbl-04",
      customerName: "Rizky Pratama",
      customerPhone: "081355667788",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        {
          productId: "prd-mieaceh-11",
          quantity: 2,
          options: [
            { groupName: "Cara Masak", optionName: "Becek (Nyemek)", priceAdjustment: 0 },
            { groupName: "Level Pedas", optionName: "Pedas Ekstra", priceAdjustment: 0 },
          ],
        },
        {
          productId: "prd-tehtarik-02",
          quantity: 2,
          options: [
            { groupName: "Suhu Penyajian", optionName: "Dingin (Es)", priceAdjustment: 2000 },
          ],
        },
      ],
    },
    {
      id: "ord-seed-003",
      orderNumber: "ORD-20261113-003",
      trackingToken: "trk_seed_003_agam",
      daysAgo: 1,
      hoursOffset: 2,
      userId: "usr-cust-002",
      customerName: "Dina Marlina",
      customerPhone: "085270002002",
      source: "WEB",
      serviceType: "TAKEAWAY",
      status: "COMPLETED",
      paymentMethod: "VIRTUAL_ACCOUNT",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-002",
      items: [
        { productId: "prd-kopijoss-09", quantity: 2 },
        { productId: "prd-rotibakar-08", quantity: 1 },
      ],
    },
    {
      id: "ord-seed-004",
      orderNumber: "ORD-20261113-004",
      trackingToken: "trk_seed_004_agam",
      daysAgo: 1,
      hoursOffset: 5,
      tableId: "tbl-02",
      customerName: "Fajar Nugroho",
      customerPhone: "081299001122",
      source: "POS",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-sanger-01", quantity: 3 },
        { productId: "prd-bangladesh-06", quantity: 2 },
        { productId: "prd-martabak-12", quantity: 1 },
      ],
    },
    {
      id: "ord-seed-005",
      orderNumber: "ORD-20261112-005",
      trackingToken: "trk_seed_005_agam",
      daysAgo: 2,
      hoursOffset: 4,
      tableId: "tbl-05",
      customerName: "Hendra Wijaya",
      customerPhone: "085266778899",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-nasgor-07", quantity: 2 },
        { productId: "prd-badak-05", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-006",
      orderNumber: "ORD-20261112-006",
      trackingToken: "trk_seed_006_agam",
      daysAgo: 2,
      hoursOffset: 7,
      customerName: "Sari Dewi",
      customerPhone: "081144556677",
      source: "WEB",
      serviceType: "TAKEAWAY",
      status: "CANCELLED",
      paymentMethod: "QRIS",
      paymentStatus: "REFUNDED",
      cashierId: "usr-cashier-002",
      refundReason: "Pelanggan membatalkan sebelum dimasak",
      items: [
        { productId: "prd-mieaceh-11", quantity: 1 },
        { productId: "prd-milo-04", quantity: 1 },
      ],
    },
    {
      id: "ord-seed-007",
      orderNumber: "ORD-20261111-007",
      trackingToken: "trk_seed_007_agam",
      daysAgo: 3,
      hoursOffset: 2,
      tableId: "tbl-03",
      customerName: "Budi Santoso",
      customerPhone: "081233445566",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-002",
      items: [
        { productId: "prd-kopihitam-03", quantity: 2 },
        { productId: "prd-pisang-13", quantity: 1 },
      ],
    },
    {
      id: "ord-seed-008",
      orderNumber: "ORD-20261110-008",
      trackingToken: "trk_seed_008_agam",
      daysAgo: 4,
      hoursOffset: 3,
      tableId: "tbl-06",
      customerName: "Komunitas Kopi Medan",
      customerPhone: "081277889900",
      source: "POS",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-sanger-01", quantity: 4 },
        { productId: "prd-tehtarik-02", quantity: 2 },
        { productId: "prd-bangladesh-06", quantity: 4 },
        { productId: "prd-martabak-12", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-009",
      orderNumber: "ORD-20261109-009",
      trackingToken: "trk_seed_009_agam",
      daysAgo: 5,
      hoursOffset: 4,
      customerName: "Nadia Putri",
      customerPhone: "082133445566",
      source: "WEB",
      serviceType: "TAKEAWAY",
      status: "COMPLETED",
      paymentMethod: "VIRTUAL_ACCOUNT",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-kopijoss-09", quantity: 3 },
        { productId: "prd-martabak-12", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-010",
      orderNumber: "ORD-20261108-010",
      trackingToken: "trk_seed_010_agam",
      daysAgo: 6,
      hoursOffset: 2,
      tableId: "tbl-01",
      customerName: "Taufik Hidayat",
      customerPhone: "081366778899",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-002",
      items: [
        { productId: "prd-bangladesh-06", quantity: 2 },
        { productId: "prd-sanger-01", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-011",
      orderNumber: "ORD-20261107-011",
      trackingToken: "trk_seed_011_agam",
      daysAgo: 7,
      hoursOffset: 6,
      tableId: "tbl-04",
      customerName: "Ilham Ramadhan",
      customerPhone: "085311223344",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-mieaceh-11", quantity: 2 },
        { productId: "prd-tehtarik-02", quantity: 2 },
        { productId: "prd-rotibakar-08", quantity: 1 },
      ],
    },
    {
      id: "ord-seed-012",
      orderNumber: "ORD-20261106-012",
      trackingToken: "trk_seed_012_agam",
      daysAgo: 8,
      hoursOffset: 3,
      tableId: "tbl-02",
      customerName: "Bagus Setiawan",
      customerPhone: "081244556677",
      source: "POS",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-nasgor-07", quantity: 2 },
        { productId: "prd-milo-04", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-013",
      orderNumber: "ORD-20261105-013",
      trackingToken: "trk_seed_013_agam",
      daysAgo: 9,
      hoursOffset: 5,
      customerName: "Maya Sari",
      customerPhone: "081399887766",
      source: "WEB",
      serviceType: "TAKEAWAY",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-002",
      items: [
        { productId: "prd-kopijoss-09", quantity: 2 },
        { productId: "prd-rotibakar-08", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-014",
      orderNumber: "ORD-20261104-014",
      trackingToken: "trk_seed_014_agam",
      daysAgo: 10,
      hoursOffset: 4,
      tableId: "tbl-05",
      customerName: "Reza Mahendra",
      customerPhone: "082255667788",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-bangladesh-06", quantity: 3 },
        { productId: "prd-sanger-01", quantity: 3 },
      ],
    },
    {
      id: "ord-seed-015",
      orderNumber: "ORD-20261103-015",
      trackingToken: "trk_seed_015_agam",
      daysAgo: 11,
      hoursOffset: 2,
      tableId: "tbl-03",
      customerName: "Ahmad Fauzi",
      customerPhone: "081211223344",
      source: "POS",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-002",
      items: [
        { productId: "prd-kopihitam-03", quantity: 2 },
        { productId: "prd-rotibakar-08", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-016",
      orderNumber: "ORD-20261102-016",
      trackingToken: "trk_seed_016_agam",
      daysAgo: 12,
      hoursOffset: 5,
      tableId: "tbl-01",
      customerName: "Yusuf Mansur",
      customerPhone: "081377889911",
      source: "WEB",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "VIRTUAL_ACCOUNT",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-mieaceh-11", quantity: 2 },
        { productId: "prd-badak-05", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-017",
      orderNumber: "ORD-20261101-017",
      trackingToken: "trk_seed_017_agam",
      daysAgo: 13,
      hoursOffset: 3,
      customerName: "Rina Oktaviani",
      customerPhone: "085244332211",
      source: "WEB",
      serviceType: "TAKEAWAY",
      status: "COMPLETED",
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-002",
      items: [
        { productId: "prd-tehtarik-02", quantity: 3 },
        { productId: "prd-pisang-13", quantity: 2 },
      ],
    },
    {
      id: "ord-seed-018",
      orderNumber: "ORD-20261031-018",
      trackingToken: "trk_seed_018_agam",
      daysAgo: 14,
      hoursOffset: 6,
      tableId: "tbl-06",
      customerName: "Tim Futsal Kampus",
      customerPhone: "081288990011",
      source: "POS",
      serviceType: "DINE_IN",
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      cashierId: "usr-cashier-001",
      items: [
        { productId: "prd-bangladesh-06", quantity: 4 },
        { productId: "prd-nasgor-07", quantity: 2 },
        { productId: "prd-sanger-01", quantity: 4 },
        { productId: "prd-tehtarik-02", quantity: 2 },
      ],
    },
  ];
}

function makeScopedId(productId: string, itemOrGroupId: string): string {
  const combined = `${productId}-${itemOrGroupId}`;
  if (combined.length <= 36) return combined;
  const compactProd = productId.replace(/^prd-/, "");
  const compactSub = itemOrGroupId.replace(/^(og|oi)-/, "");
  return `${compactProd}-${compactSub}`.slice(0, 36);
}

async function main() {
  console.log("Mulai mengisi database Warkop Agam...");

  // 1. Users (gunakan password_hash bcrypt asli dari INITIAL_MOCK_USERS)
  for (const u of INITIAL_MOCK_USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        email: u.email,
        phone: u.phone,
        password_hash: u.password_hash,
        role: u.role,
        is_active: u.is_active,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        password_hash: u.password_hash,
        role: u.role,
        is_active: u.is_active,
      },
    });
  }
  console.log(`- Users disinkronkan: ${INITIAL_MOCK_USERS.length}`);

  // 2. Restaurant Setting
  await prisma.restaurantSetting.upsert({
    where: { id: RESTAURANT_SETTING_ID },
    update: {
      restaurant_name: sampleRestaurant.name,
      address: sampleRestaurant.address,
      phone_whatsapp: sampleRestaurant.whatsapp,
      opening_hours: sampleRestaurant.openingHours,
      is_web_ordering_open: sampleRestaurant.isWebOrderingOpen,
      tax_enabled: false,
      tax_percentage: 0,
      digital_expiry_minutes: 15,
      cash_expiry_minutes: 30,
      receipt_footer_note: "Terima kasih telah menikmati sajian Warkop Agam Medan!",
      updated_by: "usr-admin-001",
    },
    create: {
      id: RESTAURANT_SETTING_ID,
      restaurant_name: sampleRestaurant.name,
      address: sampleRestaurant.address,
      phone_whatsapp: sampleRestaurant.whatsapp,
      opening_hours: sampleRestaurant.openingHours,
      is_web_ordering_open: sampleRestaurant.isWebOrderingOpen,
      tax_enabled: false,
      tax_percentage: 0,
      digital_expiry_minutes: 15,
      cash_expiry_minutes: 30,
      receipt_footer_note: "Terima kasih telah menikmati sajian Warkop Agam Medan!",
      updated_by: "usr-admin-001",
    },
  });
  console.log("- RestaurantSetting disinkronkan");

  // 3. Categories
  for (let idx = 0; idx < sampleCategories.length; idx++) {
    const cat = sampleCategories[idx];
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? null,
        sort_order: idx + 1,
        is_active: true,
        deleted_at: null,
      },
      create: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? null,
        sort_order: idx + 1,
        is_active: true,
      },
    });
  }
  console.log(`- Categories disinkronkan: ${sampleCategories.length}`);

  // 4. Products, Stocks, Option Groups & Items
  let totalOptionGroups = 0;
  let totalOptionItems = 0;

  for (let pIdx = 0; pIdx < sampleProducts.length; pIdx++) {
    const p = sampleProducts[pIdx];
    const sortOrder = p.sortOrder ?? pIdx + 1;

    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        category_id: p.categoryId,
        name: p.name,
        description: p.description,
        base_price: p.basePrice,
        image_url: p.imageUrl ?? null,
        is_available: p.availableQty > 0,
        sort_order: sortOrder,
        deleted_at: null,
      },
      create: {
        id: p.id,
        category_id: p.categoryId,
        name: p.name,
        description: p.description,
        base_price: p.basePrice,
        image_url: p.imageUrl ?? null,
        is_available: p.availableQty > 0,
        sort_order: sortOrder,
      },
    });

    await prisma.productStock.upsert({
      where: { product_id: p.id },
      update: {
        available_qty: p.availableQty,
        min_threshold: p.minThreshold ?? 5,
      },
      create: {
        product_id: p.id,
        available_qty: p.availableQty,
        reserved_qty: 0,
        min_threshold: p.minThreshold ?? 5,
      },
    });

    const groups = p.options ?? [];
    const expectedGroupIds = groups.map((g) => makeScopedId(p.id, g.id));

    // Bersihkan option group lama yang tidak lagi ada di menu-data
    await prisma.productOptionGroup.deleteMany({
      where: {
        product_id: p.id,
        id: { notIn: expectedGroupIds },
      },
    });

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const g = groups[gIdx];
      const dbGroupId = makeScopedId(p.id, g.id);
      totalOptionGroups += 1;

      await prisma.productOptionGroup.upsert({
        where: { id: dbGroupId },
        update: {
          product_id: p.id,
          name: g.name,
          is_required: g.required,
          min_select: g.required ? 1 : 0,
          max_select: g.type === "single" ? 1 : g.items.length,
          sort_order: gIdx + 1,
        },
        create: {
          id: dbGroupId,
          product_id: p.id,
          name: g.name,
          is_required: g.required,
          min_select: g.required ? 1 : 0,
          max_select: g.type === "single" ? 1 : g.items.length,
          sort_order: gIdx + 1,
        },
      });

      const expectedItemIds = g.items.map((item) => makeScopedId(p.id, item.id));
      await prisma.productOptionItem.deleteMany({
        where: {
          option_group_id: dbGroupId,
          id: { notIn: expectedItemIds },
        },
      });

      for (let iIdx = 0; iIdx < g.items.length; iIdx++) {
        const item = g.items[iIdx];
        const dbItemId = makeScopedId(p.id, item.id);
        totalOptionItems += 1;

        await prisma.productOptionItem.upsert({
          where: { id: dbItemId },
          update: {
            option_group_id: dbGroupId,
            name: item.name,
            price_adjustment: item.price,
            is_available: true,
            sort_order: iIdx + 1,
          },
          create: {
            id: dbItemId,
            option_group_id: dbGroupId,
            name: item.name,
            price_adjustment: item.price,
            is_available: true,
            sort_order: iIdx + 1,
          },
        });
      }
    }
  }
  // Soft-delete produk lama yang tidak lagi ada di menu-data
  const activeProductIds = sampleProducts.map((p) => p.id);
  await prisma.product.updateMany({
    where: { id: { notIn: activeProductIds } },
    data: { is_available: false, deleted_at: new Date() },
  });

  console.log(
    `- Products disinkronkan: ${sampleProducts.length}, OptionGroups: ${totalOptionGroups}, OptionItems: ${totalOptionItems}`
  );

  // 5. Tables & QR Codes
  for (const tbl of SEED_TABLES) {
    await prisma.table.upsert({
      where: { id: tbl.id },
      update: {
        table_number: tbl.table_number,
        name: tbl.name,
        capacity: tbl.capacity,
        status: "AVAILABLE",
        is_active: true,
      },
      create: {
        id: tbl.id,
        table_number: tbl.table_number,
        name: tbl.name,
        capacity: tbl.capacity,
        status: "AVAILABLE",
        is_active: true,
      },
    });

    await prisma.tableQrCode.upsert({
      where: { token: tbl.qr_token },
      update: {
        table_id: tbl.id,
        is_active: true,
        generated_by: "usr-admin-001",
      },
      create: {
        id: `qr-${tbl.id}`,
        table_id: tbl.id,
        token: tbl.qr_token,
        is_active: true,
        generated_by: "usr-admin-001",
      },
    });
  }
  console.log(`- Tables & QR disinkronkan: ${SEED_TABLES.length}`);

  // 6. Stock Movements (hanya jika tabel masih kosong)
  const existingMovementCount = await prisma.stockMovement.count();
  if (existingMovementCount === 0) {
    for (const p of sampleProducts) {
      await prisma.stockMovement.create({
        data: {
          id: `sm-init-${p.id}`,
          product_id: p.id,
          actor_id: "usr-admin-001",
          movement_type: "INITIAL_STOCK",
          qty_change: p.availableQty,
          available_before: 0,
          available_after: p.availableQty,
          reserved_before: 0,
          reserved_after: 0,
          reason: "Stok awal outlet Warkop Agam",
        },
      });
    }
    console.log(`- StockMovements awal dibuat: ${sampleProducts.length}`);
  }

  // 7. Historical & Active Orders, Items, Options, Payments & Receipts
  const existingOrderCount = await prisma.order.count();
  if (existingOrderCount === 0) {
    const productMap = new Map(sampleProducts.map((p) => [p.id, p]));
    const specs = buildHistoricalOrderSpecs();
    const now = new Date();

    for (const spec of specs) {
      const createdAt = new Date(
        now.getTime() - spec.daysAgo * 86400000 - spec.hoursOffset * 3600000
      );

      let subtotal = 0;
      const itemPayloads = spec.items.map((item, idx) => {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new Error(`Produk ${item.productId} tidak ditemukan di sampleProducts`);
        }
        const optSum = (item.options ?? []).reduce(
          (sum, opt) => sum + opt.priceAdjustment,
          0
        );
        const unitPrice = prod.basePrice + optSum;
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;

        return {
          id: `${spec.id}-item-${idx + 1}`,
          product_id: prod.id,
          product_name_snapshot: prod.name,
          unit_price_snapshot: prod.basePrice,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          item_notes: item.notes ?? null,
          options: item.options ?? [],
        };
      });

      const taxAmount = Math.round(subtotal * (TAX_PERCENTAGE / 100));
      const totalAmount = subtotal + taxAmount;

      await prisma.order.create({
        data: {
          id: spec.id,
          order_number: spec.orderNumber,
          user_id: spec.userId ?? null,
          table_id: spec.tableId ?? null,
          customer_name: spec.customerName,
          customer_phone: spec.customerPhone,
          tracking_token: spec.trackingToken,
          source: spec.source,
          service_type: spec.serviceType,
          status: spec.status,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: spec.notes ?? null,
          created_at: createdAt,
          items: {
            create: itemPayloads.map((ip) => ({
              id: ip.id,
              product_id: ip.product_id,
              product_name_snapshot: ip.product_name_snapshot,
              unit_price_snapshot: ip.unit_price_snapshot,
              quantity: ip.quantity,
              subtotal: ip.subtotal,
              item_notes: ip.item_notes,
              options: ip.options.length
                ? {
                    create: ip.options.map((opt) => ({
                      option_group_name_snapshot: opt.groupName,
                      option_name_snapshot: opt.optionName,
                      price_adjustment_snapshot: opt.priceAdjustment,
                    })),
                  }
                : undefined,
            })),
          },
        },
      });

      const paidAt =
        spec.paymentStatus === "PAID" || spec.paymentStatus === "REFUNDED"
          ? new Date(createdAt.getTime() + 5 * 60000)
          : null;
      const refundedAt =
        spec.paymentStatus === "REFUNDED"
          ? new Date(createdAt.getTime() + 15 * 60000)
          : null;

      const payment = await prisma.payment.create({
        data: {
          order_id: spec.id,
          cashier_id: spec.cashierId ?? null,
          method: spec.paymentMethod,
          status: spec.paymentStatus,
          amount_due: totalAmount,
          amount_paid: spec.paymentStatus === "UNPAID" ? 0 : totalAmount,
          change_amount: 0,
          paid_at: paidAt,
          refunded_at: refundedAt,
          refund_reason: spec.refundReason ?? null,
        },
      });

      if (spec.status === "COMPLETED") {
        await prisma.receipt.create({
          data: {
            id: `rcp-${spec.id}`,
            order_id: spec.id,
            payment_id: payment.id,
            printed_by: spec.cashierId ?? "usr-cashier-001",
            receipt_number: `RCP-${spec.orderNumber.replace("ORD-", "")}`,
            paper_size: "80MM",
            print_count: 1,
            receipt_snapshot: {
              orderNumber: spec.orderNumber,
              customerName: spec.customerName,
              totalAmount,
              method: spec.paymentMethod,
            },
          },
        });
      }
    }
    console.log(`- Orders riwayat & aktif dibuat: ${specs.length}`);
  }

  // 8. Audit Logs
  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          id: "aud-seed-001",
          actor_id: "usr-admin-001",
          actor_role: "ADMIN",
          entity_name: "RestaurantSetting",
          entity_id: RESTAURANT_SETTING_ID,
          action: "SEED_INITIAL_SETTINGS",
          reason: "Inisialisasi profil Warkop Agam Medan",
        },
        {
          id: "aud-seed-002",
          actor_id: "usr-admin-001",
          actor_role: "ADMIN",
          entity_name: "Product",
          entity_id: "CATALOG",
          action: "SEED_CATALOG_MENU",
          reason: "Sinkronisasi 13 menu beserta opsi varian dan stok",
        },
        {
          id: "aud-seed-003",
          actor_id: "usr-admin-001",
          actor_role: "ADMIN",
          entity_name: "Table",
          entity_id: "ALL",
          action: "SEED_TABLES_QR",
          reason: `Aktivasi ${SEED_TABLES.length} meja dan kode QR pemesanan`,
        },
      ],
    });
    console.log("- AuditLogs awal dibuat: 3");
  }

  console.log("Selesai mengisi database Warkop Agam.");
}

main()
  .catch((err) => {
    console.error("Gagal menjalankan seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
