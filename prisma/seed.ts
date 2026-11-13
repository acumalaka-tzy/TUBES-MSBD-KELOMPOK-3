import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding data Warkop Agam...");

  // 1. Users
  const users = [
    {
      id: "usr-admin-001",
      name: "Bang Agam (Owner)",
      email: "admin@warkopagam.id",
      phone: "081260001001",
      password_hash: "$2b$12$examplehashedpasswordadmin0000000000000000000001",
      role: "ADMIN",
      is_active: true,
    },
    {
      id: "usr-cashier-001",
      name: "Rizky Pratama",
      email: "rizky.kasir@warkopagam.id",
      phone: "081260001002",
      password_hash: "$2b$12$examplehashedpasswordcashier00000000000000000002",
      role: "CASHIER",
      is_active: true,
    },
    {
      id: "usr-cashier-002",
      name: "Siti Rahma",
      email: "siti.kasir@warkopagam.id",
      phone: "081260001003",
      password_hash: "$2b$12$examplehashedpasswordcashier00000000000000000003",
      role: "CASHIER",
      is_active: true,
    },
    {
      id: "usr-cust-001",
      name: "Andi Saputra",
      email: "andi.customer@gmail.com",
      phone: "085270002001",
      password_hash: "$2b$12$examplehashedpasswordcust00000000000000000000004",
      role: "CUSTOMER",
      is_active: true,
    },
    {
      id: "usr-cust-002",
      name: "Dina Marlina",
      email: "dina.customer@gmail.com",
      phone: "085270002002",
      password_hash: "$2b$12$examplehashedpasswordcust00000000000000000000005",
      role: "CUSTOMER",
      is_active: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: u,
    });
  }

  // 2. Restaurant Settings
  await prisma.restaurantSetting.upsert({
    where: { id: "set-main-001" },
    update: {},
    create: {
      id: "set-main-001",
      restaurant_name: "Warkop Agam",
      address: "Jl. H. Misbah No. 14, Medan Maimun, Kota Medan, Sumatera Utara",
      phone_whatsapp: "6281260001001",
      opening_hours: "Senin - Minggu, 07.00 - 02.00 WIB",
      is_web_ordering_open: true,
      tax_enabled: true,
      tax_percentage: 10.0,
      digital_expiry_minutes: 15,
      cash_expiry_minutes: 30,
      receipt_footer_note: "Terima kasih telah bersantai di Warkop Agam! WiFi: WarkopAgam_Guest",
      updated_by: "usr-admin-001",
    },
  });

  // 3. Categories
  const categories = [
    {
      id: "cat-kopi-01",
      name: "Kopi & Minuman Hangat",
      slug: "kopi-minuman-hangat",
      description: "Racikan kopi saring khas Aceh-Medan dan teh tarik legendaris.",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "cat-dingin-02",
      name: "Minuman Dingin & Segar",
      slug: "minuman-dingin-segar",
      description: "Minuman dingin penyegar dahaga khas warkop.",
      sort_order: 2,
      is_active: true,
    },
    {
      id: "cat-mie-03",
      name: "Mie & Makanan Berat",
      slug: "mie-makanan-berat",
      description: "Indomie Bangladesh, nasi goreng, dan hidangan mengenyangkan.",
      sort_order: 3,
      is_active: true,
    },
    {
      id: "cat-camilan-04",
      name: "Roti Bakar & Camilan",
      slug: "roti-bakar-camilan",
      description: "Teman ngopi santai mulai dari roti bakar hingga martabak mie.",
      sort_order: 4,
      is_active: true,
    },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  // 4. Products
  const products = [
    {
      id: "prd-sanger-01",
      category_id: "cat-kopi-01",
      name: "Kopi Sanger Espresso",
      description: "Perpaduan kopi robusta saring kental dengan susu kental manis pas takaran.",
      base_price: 14000.0,
      image_url: "/images/menu/kopi-sanger.webp",
      is_available: true,
      sort_order: 1,
      stock: 50,
    },
    {
      id: "prd-tehtarik-02",
      category_id: "cat-kopi-01",
      name: "Teh Tarik Aceh",
      description: "Teh hitam pilihan ditarik berbusa lembut dengan susu creamy.",
      base_price: 13000.0,
      image_url: "/images/menu/teh-tarik.webp",
      is_available: true,
      sort_order: 2,
      stock: 45,
    },
    {
      id: "prd-kopihitam-03",
      category_id: "cat-kopi-01",
      name: "Kopi Hitam Ulee Kareng",
      description: "Kopi hitam khas Aceh dengan aroma kuat dan rasa autentik.",
      base_price: 10000.0,
      image_url: "/images/menu/kopi-hitam.webp",
      is_available: true,
      sort_order: 3,
      stock: 60,
    },
    {
      id: "prd-milo-04",
      category_id: "cat-dingin-02",
      name: "Es Milo Kepal Warkop",
      description: "Es Milo kental dingin dengan taburan bubuk Milo melimpah.",
      base_price: 16000.0,
      image_url: "/images/menu/es-milo.webp",
      is_available: true,
      sort_order: 1,
      stock: 30,
    },
    {
      id: "prd-badak-05",
      category_id: "cat-dingin-02",
      name: "Es Soda Susu Badak",
      description: "Minuman legendaris Sumatera Utara: limun Sarsaparilla Badak dengan susu.",
      base_price: 15000.0,
      image_url: "/images/menu/soda-badak.webp",
      is_available: true,
      sort_order: 2,
      stock: 24,
    },
    {
      id: "prd-bangladesh-06",
      category_id: "cat-mie-03",
      name: "Indomie Bangladesh Spesial",
      description: "Mie nyemek racikan bumbu rempah rahasia Warkop Agam dengan telur setengah matang.",
      base_price: 18000.0,
      image_url: "/images/menu/indomie-bangladesh.webp",
      is_available: true,
      sort_order: 1,
      stock: 40,
    },
    {
      id: "prd-nasgor-07",
      category_id: "cat-mie-03",
      name: "Nasi Goreng Kampung Agam",
      description: "Nasi goreng bumbu terasi ringan, suwiran ayam, telur mata sapi, dan kerupuk.",
      base_price: 22000.0,
      image_url: "/images/menu/nasi-goreng.webp",
      is_available: true,
      sort_order: 2,
      stock: 25,
    },
    {
      id: "prd-rotibakar-08",
      category_id: "cat-camilan-04",
      name: "Roti Bakar Cokelat Keju",
      description: "Roti panggang garing di luar lembut di dalam dengan isian cokelat lumer dan keju parut.",
      base_price: 15000.0,
      image_url: "/images/menu/roti-bakar.webp",
      is_available: true,
      sort_order: 1,
      stock: 35,
    },
    {
      id: "prd-kopijoss-09",
      category_id: "cat-kopi-01",
      name: "Kopi Susu Gula Aren",
      description: "Espresso robusta dengan susu segar dan gula aren asli.",
      base_price: 16000.0,
      image_url: "/images/menu/kopi-aren.webp",
      is_available: true,
      sort_order: 4,
      stock: 3,
    },
    {
      id: "prd-jeruk-10",
      category_id: "cat-dingin-02",
      name: "Es Jeruk Peras Murni",
      description: "Perasan jeruk manis segar dengan es batu kristal tanpa pengawet.",
      base_price: 10000.0,
      image_url: "/images/menu/es-jeruk.webp",
      is_available: false,
      sort_order: 3,
      stock: 0,
    },
    {
      id: "prd-mieaceh-11",
      category_id: "cat-mie-03",
      name: "Mie Aceh Daging Tumis",
      description: "Mie kuning tebal dimasak bumbu kari kental khas Aceh dengan irisan daging sapi.",
      base_price: 26000.0,
      image_url: "/images/menu/mie-aceh.webp",
      is_available: true,
      sort_order: 3,
      stock: 4,
    },
    {
      id: "prd-martabak-12",
      category_id: "cat-camilan-04",
      name: "Martabak Mie Telur Bebek",
      description: "Martabak mie goreng gurih tebal disajikan dengan kuah acar cabai rawit.",
      base_price: 17000.0,
      image_url: "/images/menu/martabak-mie.webp",
      is_available: true,
      sort_order: 2,
      stock: 18,
    },
    {
      id: "prd-pisang-13",
      category_id: "cat-camilan-04",
      name: "Pisang Goreng Srikaya",
      description: "Pisang kepok goreng krispi disajikan hangat dengan selai srikaya pandan.",
      base_price: 12000.0,
      image_url: "/images/menu/pisang-srikaya.webp",
      is_available: false,
      sort_order: 3,
      stock: 0,
    },
  ];

  for (const p of products) {
    const { stock, ...productData } = p;
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: productData,
    });

    await prisma.productStock.upsert({
      where: { product_id: p.id },
      update: {},
      create: {
        product_id: p.id,
        available_qty: stock,
        reserved_qty: 0,
        min_threshold: 5,
      },
    });
  }

  // 5. Product Option Groups & Items
  const optionGroups = [
    {
      id: "og-sanger-suhu",
      product_id: "prd-sanger-01",
      name: "Suhu Penyajian",
      is_required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      items: [
        { id: "oi-sanger-panas", name: "Panas", price_adjustment: 0.0, sort_order: 1 },
        { id: "oi-sanger-dingin", name: "Dingin (Es)", price_adjustment: 2000.0, sort_order: 2 },
      ],
    },
    {
      id: "og-sanger-gula",
      product_id: "prd-sanger-01",
      name: "Tingkat Manis",
      is_required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 2,
      items: [
        { id: "oi-sanger-normal", name: "Manis Normal", price_adjustment: 0.0, sort_order: 1 },
        { id: "oi-sanger-less", name: "Less Sugar", price_adjustment: 0.0, sort_order: 2 },
      ],
    },
    {
      id: "og-tehtarik-suhu",
      product_id: "prd-tehtarik-02",
      name: "Suhu Penyajian",
      is_required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      items: [
        { id: "oi-tehtarik-panas", name: "Panas", price_adjustment: 0.0, sort_order: 1 },
        { id: "oi-tehtarik-dingin", name: "Dingin (Es)", price_adjustment: 2000.0, sort_order: 2 },
      ],
    },
    {
      id: "og-bangladesh-pedas",
      product_id: "prd-bangladesh-06",
      name: "Level Pedas",
      is_required: true,
      min_select: 1,
      max_select: 1,
      sort_order: 1,
      items: [
        { id: "oi-pedas-sedang", name: "Pedas Sedang (Standar)", price_adjustment: 0.0, sort_order: 1 },
        { id: "oi-pedas-ekstra", name: "Pedas Ekstra", price_adjustment: 0.0, sort_order: 2 },
        { id: "oi-pedas-tidak", name: "Tidak Pedas", price_adjustment: 0.0, sort_order: 3 },
      ],
    },
    {
      id: "og-bangladesh-topping",
      product_id: "prd-bangladesh-06",
      name: "Tambahan Topping",
      is_required: false,
      min_select: 0,
      max_select: 3,
      sort_order: 2,
      items: [
        { id: "oi-top-telur", name: "Tambah Telur Setengah Matang", price_adjustment: 4000.0, sort_order: 1 },
        { id: "oi-top-sosis", name: "Tambah Sosis Ayam", price_adjustment: 5000.0, sort_order: 2 },
        { id: "oi-top-keju", name: "Tambah Keju Parut", price_adjustment: 4000.0, sort_order: 3 },
      ],
    },
  ];

  for (const g of optionGroups) {
    const { items, ...groupData } = g;
    await prisma.productOptionGroup.upsert({
      where: { id: g.id },
      update: {},
      create: groupData,
    });

    for (const item of items) {
      await prisma.productOptionItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          option_group_id: g.id,
          name: item.name,
          price_adjustment: item.price_adjustment,
          sort_order: item.sort_order,
          is_available: true,
        },
      });
    }
  }

  // 6. Tables & Table QR Codes
  const tables = [
    { id: "tbl-01", table_number: "01", name: "Meja 01 (Indoor)", capacity: 4, token: "qr_tok_agam_m01_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c" },
    { id: "tbl-02", table_number: "02", name: "Meja 02 (Indoor)", capacity: 4, token: "qr_tok_agam_m02_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d" },
    { id: "tbl-03", table_number: "03", name: "Meja 03 (Indoor)", capacity: 2, token: "qr_tok_agam_m03_7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f" },
    { id: "tbl-04", table_number: "04", name: "Meja 04 (Teras)",  capacity: 4, token: "qr_tok_agam_m04_4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b" },
    { id: "tbl-05", table_number: "05", name: "Meja 05 (Teras)",  capacity: 6, token: "qr_tok_agam_m05_2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f" },
    { id: "tbl-06", table_number: "06", name: "Meja 06 (VIP)",    capacity: 8, token: "qr_tok_agam_m06_8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d" },
  ];

  for (const t of tables) {
    await prisma.table.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        table_number: t.table_number,
        name: t.name,
        capacity: t.capacity,
        status: "AVAILABLE",
        is_active: true,
      },
    });

    await prisma.tableQrCode.upsert({
      where: { id: `qr-${t.table_number}` },
      update: {},
      create: {
        id: `qr-${t.table_number}`,
        table_id: t.id,
        token: t.token,
        is_active: true,
        generated_by: "usr-admin-001",
      },
    });
  }

  console.log("Seeding Warkop Agam selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

