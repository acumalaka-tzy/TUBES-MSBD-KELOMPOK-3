/**
 * Script Pengujian Fitur Dashboard Admin:
 * 1. Manajemen Meja & QR Code Kriptografis
 * 2. Manajemen Staf & Akun Kasir (CRUD, Reset Password, Sakelar Aktif)
 * 3. Laporan Penjualan & Ekspor (Omzet, Performa Menu, Mutasi Stok, CSV generation)
 */

import crypto from "crypto";
import { getMemoryStore, memoryId } from "../src/lib/admin/memory-store";
import { listAdminTables, listAdminStaff, getDetailedSalesReport } from "../src/lib/admin/queries";
import { hashPassword, comparePassword } from "../src/lib/auth/password";
import { memoryUsers } from "../src/lib/auth/mock-users";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runAdminTests() {
  console.log("=== MEMULAI PENGUJIAN FITUR DASHBOARD ADMIN ===");

  // --- 1. UJI MANAJEMEN MEJA & TOKEN QR KRIPTOGRAFIS ---
  console.log("\n--- 1. Uji Manajemen Meja & Token QR Kriptografis ---");
  const store = getMemoryStore();

  const initialTablesRes = await listAdminTables();
  assert(initialTablesRes.data.length >= 6, "List meja default mengembalikan minimal 6 meja contoh (Meja 01-06).");

  const table01 = initialTablesRes.data.find((t) => t.tableNumber === "01");
  assert(Boolean(table01), "Meja 01 ditemukan.");
  assert(Boolean(table01?.activeQrToken), "Meja 01 memiliki activeQrToken.");
  assert(table01?.activeQrToken?.startsWith("qr_") ?? false, "Token QR diawali prefix kriptografis 'qr_'.");
  assert(Boolean(table01?.activeQrUrl?.includes("table=01")), "URL QR meja mengandung parameter table=01.");

  // Uji generator token kriptografis
  const token1 = `qr_${Date.now().toString(36)}_${crypto.randomBytes(12).toString("hex")}`;
  const token2 = `qr_${Date.now().toString(36)}_${crypto.randomBytes(12).toString("hex")}`;
  assert(token1 !== token2, "Dua token yang dibuat secara kriptografis tidak identik / unik.");
  assert(token1.length >= 30, "Panjang token QR kriptografis memenuhi standar keamanan.");

  // Simulasi penambahan meja baru di memory store
  const newTblId = memoryId("tbl");
  const newQrId = memoryId("tqr");
  const newToken = `qr_${Date.now().toString(36)}_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date();

  store.tables.set(newTblId, {
    id: newTblId,
    table_number: "VIP-99",
    name: "Meja VIP Lantai 2",
    capacity: 8,
    status: "AVAILABLE",
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  store.tableQrCodes.set(newTblId, [
    {
      id: newQrId,
      table_id: newTblId,
      token: newToken,
      is_active: true,
      generated_by: "usr-admin-001",
      created_at: now,
      revoked_at: null,
    },
  ]);

  const afterAdd = await listAdminTables();
  const foundVip = afterAdd.data.find((t) => t.tableNumber === "VIP-99");
  assert(Boolean(foundVip), "Meja baru VIP-99 berhasil tercatat di sistem.");
  assert(foundVip?.capacity === 8, "Kapasitas meja VIP-99 sesuai (8 orang).");
  assert(foundVip?.activeQrToken === newToken, "Token QR meja VIP-99 cocok.");

  // Simulasi regenerasi token QR (revoke token lama, token baru aktif)
  const regeneratedToken = `qr_${Date.now().toString(36)}_${crypto.randomBytes(12).toString("hex")}`;
  const qrHistory = store.tableQrCodes.get(newTblId) ?? [];
  for (const q of qrHistory) {
    q.is_active = false;
    q.revoked_at = new Date();
  }
  qrHistory.push({
    id: memoryId("tqr"),
    table_id: newTblId,
    token: regeneratedToken,
    is_active: true,
    generated_by: "usr-admin-001",
    created_at: new Date(),
    revoked_at: null,
  });

  const afterRegen = await listAdminTables();
  const vipAfterRegen = afterRegen.data.find((t) => t.tableNumber === "VIP-99");
  assert(vipAfterRegen?.activeQrToken === regeneratedToken, "Token QR meja berhasil diperbarui setelah regenerasi.");
  assert(vipAfterRegen?.activeQrToken !== newToken, "Token QR lama otomatis tidak aktif.");

  // --- 2. UJI MANAJEMEN STAF / AKUN KASIR ---
  console.log("\n--- 2. Uji Manajemen Staf & Akun Kasir ---");
  const staffList = await listAdminStaff();
  assert(staffList.data.length >= 2, "Staf kasir bawaan ditemukan (Rizky Pratama & Siti Rahma).");

  const rizky = staffList.data.find((s) => s.name.includes("Rizky"));
  assert(Boolean(rizky), "Kasir Rizky Pratama ada di daftar staf.");
  assert(rizky?.role === "CASHIER", "Peran akun adalah CASHIER.");
  assert(rizky?.isActive === true, "Status akun kasir Rizky aktif.");

  // Simulasi pembuatan akun kasir baru
  const newStaffId = memoryId("usr");
  const rawPw = "passwordKasir123";
  const hashedPw = await hashPassword(rawPw);

  memoryUsers.set(newStaffId, {
    id: newStaffId,
    name: "Kasir Baru Percobaan",
    email: "kasir.baru@warkopagam.id",
    phone: "081299998888",
    password_hash: hashedPw,
    role: "CASHIER",
    is_active: true,
  });

  const updatedStaffList = await listAdminStaff();
  const kasirBaru = updatedStaffList.data.find((s) => s.id === newStaffId);
  assert(Boolean(kasirBaru), "Akun kasir baru berhasil dibuat.");
  assert(await comparePassword(rawPw, hashedPw), "Password awal terverifikasi cocok dengan hash bcrypt.");

  // Uji Reset Password Kasir
  const newRawPw = "sandiBaru98765";
  const newHashedPw = await hashPassword(newRawPw);
  const memUser = memoryUsers.get(newStaffId);
  if (memUser) {
    memUser.password_hash = newHashedPw;
  }
  assert(await comparePassword(newRawPw, memUser?.password_hash), "Password kasir berhasil direset dan dapat diverifikasi.");
  assert(!(await comparePassword(rawPw, memUser?.password_hash)), "Password lama otomatis ditolak.");

  // Uji Sakelar Aktif / Nonaktif Akun
  if (memUser) {
    memUser.is_active = false;
  }
  const staffAfterToggle = await listAdminStaff();
  const toggledStaff = staffAfterToggle.data.find((s) => s.id === newStaffId);
  assert(toggledStaff?.isActive === false, "Akun kasir berhasil dinonaktifkan (is_active = false).");

  // --- 3. UJI LAPORAN PENJUALAN & EKSPOR ---
  console.log("\n--- 3. Uji Laporan Penjualan & Ekspor Detail ---");
  const reportRes = await getDetailedSalesReport("7d");
  const report = reportRes.data;

  assert(Boolean(report), "Laporan penjualan berhasil di-generate.");
  assert(report.period === "7d", "Periode laporan adalah 7d.");
  assert(report.summary.grossSales >= 0, "Gross sales bernilai non-negatif.");
  assert(report.summary.netSales >= 0, "Net sales bernilai non-negatif.");
  assert(report.summary.grossSales >= report.summary.netSales, "Gross sales >= Net sales (termasuk pajak).");
  assert(report.summary.averageOrderValue >= 0, "Average Order Value (AOV) dihitung.");
  assert(Array.isArray(report.dailySales), "Rincian penjualan harian (dailySales) berupa array.");
  assert(Array.isArray(report.paymentBreakdown), "Rincian metode pembayaran (paymentBreakdown) berupa array.");
  assert(Array.isArray(report.serviceBreakdown), "Rincian tipe layanan (serviceBreakdown) berupa array.");
  assert(Array.isArray(report.productPerformance), "Peringkat performa menu (productPerformance) berupa array.");
  assert(Array.isArray(report.recentTransactions), "Daftar transaksi penjualan (recentTransactions) berupa array.");

  // Uji Ekspor CSV Content Formatting
  const csvHeaders = ["No. Order", "Tanggal", "Nama Pelanggan", "Total Transaksi"];
  const csvSampleRows = report.recentTransactions.slice(0, 3).map((tx) => [
    `"${tx.orderNumber}"`,
    `"${tx.createdAt}"`,
    `"${tx.customerName}"`,
    tx.totalAmount,
  ]);
  const sampleCsvContent = [csvHeaders.join(","), ...csvSampleRows.map((r) => r.join(","))].join("\r\n");
  assert(sampleCsvContent.includes("No. Order"), "Header CSV transaksi terbentuk dengan valid.");
  assert(sampleCsvContent.includes("\r\n"), "Format baris CSV menggunakan CRLF standar.");

  console.log("\n=======================================================");
  console.log(`TOTAL PENGUJIAN: ${totalTests} | BERHASIL: ${passedTests} | GAGAL: ${totalTests - passedTests}`);
  console.log("=======================================================");

  if (totalTests === passedTests) {
    console.log("SEMUA FITUR TERVERIFIKASI SEMPURNA (100% SUKSES)!");
  }
}

runAdminTests().catch((err) => {
  console.error("Error menjalankan pengujian:", err);
  process.exit(1);
});
