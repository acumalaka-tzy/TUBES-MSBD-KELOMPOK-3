import { signAuthToken, verifyAuthToken } from "../src/lib/auth/jwt";
import { hashPassword, comparePassword } from "../src/lib/auth/password";
import { evaluatePathAccess } from "../src/lib/auth/rbac";
import { authenticateUser, registerNewUser } from "../src/lib/auth/user-service";
import { createOrder } from "../src/app/actions/checkout";

async function runTests() {
  console.log("=== MEMULAI PENGUJIAN AUTENTIKASI & KEAMANAN (RBAC) ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. Uji JWT Signing & Verification
  // --------------------------------------------------------------------------
  console.log("--- 1. Uji JWT Signing & Verification ---");
  const testAdminUser = {
    id: "test-admin-1",
    name: "Admin Tester",
    email: "admin.test@warkop.id",
    phone: "081234567890",
    role: "ADMIN" as const,
    isActive: true,
  };

  const token = await signAuthToken(testAdminUser);
  assert(typeof token === "string" && token.length > 20, "JWT token berhasil di-generate.");

  const payload = await verifyAuthToken(token);
  assert(payload !== null && payload.sub === "test-admin-1", "JWT token berhasil diverifikasi dan sub cocok.");
  assert(payload?.role === "ADMIN", "Role dalam JWT payload cocok (ADMIN).");

  const invalidPayload = await verifyAuthToken("invalid.token.signature");
  assert(invalidPayload === null, "Token tidak valid ditolak oleh verifier.");

  // --------------------------------------------------------------------------
  // 2. Uji Bcrypt Password Hashing
  // --------------------------------------------------------------------------
  console.log("\n--- 2. Uji Bcrypt Password Hashing ---");
  const plainPassword = "SuperSecretPassword123!";
  const hash = await hashPassword(plainPassword);
  assert(hash.startsWith("$2a$") || hash.startsWith("$2b$"), "Bcrypt hash berformat valid.");

  const isMatch = await comparePassword(plainPassword, hash);
  assert(isMatch === true, "Bcrypt verifikasi password cocok.");

  const isWrong = await comparePassword("WrongPassword", hash);
  assert(isWrong === false, "Bcrypt verifikasi password salah ditolak.");

  // --------------------------------------------------------------------------
  // 3. Uji Evaluasi RBAC (Role-Based Access Control)
  // --------------------------------------------------------------------------
  console.log("\n--- 3. Uji Evaluasi RBAC (Role-Based Access Control) ---");
  // A. Admin Route (/admin)
  const unauthAdmin = evaluatePathAccess("/admin", null);
  assert(unauthAdmin.isProtected && !unauthAdmin.allowed && unauthAdmin.redirectUrl?.includes("/login"), "User tanpa login diarahkan ke /login saat akses /admin.");

  const custAdmin = evaluatePathAccess("/admin", "CUSTOMER");
  assert(custAdmin.isProtected && !custAdmin.allowed && custAdmin.redirectUrl === "/unauthorized", "CUSTOMER ditolak (403/unauthorized) saat akses /admin.");

  const cashierAdmin = evaluatePathAccess("/admin", "CASHIER");
  assert(cashierAdmin.isProtected && !cashierAdmin.allowed && cashierAdmin.redirectUrl === "/unauthorized", "CASHIER ditolak (403/unauthorized) saat akses /admin.");

  const adminAdmin = evaluatePathAccess("/admin", "ADMIN");
  assert(adminAdmin.isProtected && adminAdmin.allowed, "ADMIN diizinkan mengakses /admin.");

  // B. Cashier Route (/cashier)
  const unauthCashier = evaluatePathAccess("/cashier", null);
  assert(unauthCashier.isProtected && !unauthCashier.allowed && unauthCashier.redirectUrl?.includes("/login"), "User tanpa login diarahkan ke /login saat akses /cashier.");

  const custCashier = evaluatePathAccess("/cashier", "CUSTOMER");
  assert(custCashier.isProtected && !custCashier.allowed && custCashier.redirectUrl === "/unauthorized", "CUSTOMER ditolak saat akses /cashier.");

  const cashierCashier = evaluatePathAccess("/cashier", "CASHIER");
  assert(cashierCashier.isProtected && cashierCashier.allowed, "CASHIER diizinkan mengakses /cashier.");

  const adminCashier = evaluatePathAccess("/cashier", "ADMIN");
  assert(adminCashier.isProtected && adminCashier.allowed, "ADMIN diizinkan mengakses /cashier.");

  // C. Public Route (/)
  const publicAccess = evaluatePathAccess("/", null);
  assert(!publicAccess.isProtected && publicAccess.allowed, "Halaman beranda (/) adalah publik.");

  // --------------------------------------------------------------------------
  // 4. Uji User Authentication & Registration Service
  // --------------------------------------------------------------------------
  console.log("\n--- 4. Uji User Authentication & Registration Service ---");
  // Login Admin
  const adminLogin = await authenticateUser("admin@warkopagam.id", "admin123");
  assert(adminLogin.user !== null && adminLogin.user.role === "ADMIN", "Admin dapat login dengan kredensial yang sah.");

  // Login Kasir
  const cashierLogin = await authenticateUser("081260001002", "kasir123");
  assert(cashierLogin.user !== null && cashierLogin.user.role === "CASHIER", "Kasir dapat login via nomor HP.");

  // Login Customer Terdaftar
  const custLogin = await authenticateUser("andi.customer@gmail.com", "customer123");
  assert(custLogin.user !== null && custLogin.user.role === "CUSTOMER", "Customer terdaftar dapat login.");

  // Login Gagal (Password salah)
  const failLogin = await authenticateUser("admin@warkopagam.id", "salahpassword");
  assert(failLogin.user === null && !!failLogin.error, "Login ditolak jika password salah.");

  // Registrasi Customer Baru
  const newEmail = `user.${Date.now()}@test.com`;
  const regResult = await registerNewUser({
    name: "Customer Baru",
    email: newEmail,
    phone: `0899${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "passwordbaru123",
  });
  assert(regResult.user !== null && regResult.user.role === "CUSTOMER", "Registrasi Customer baru berhasil dengan role CUSTOMER.");

  // --------------------------------------------------------------------------
  // 5. Uji Guest Checkout vs Registered Customer Checkout
  // --------------------------------------------------------------------------
  console.log("\n--- 5. Uji Guest Checkout vs Registered Customer Checkout ---");
  // A. Guest Checkout (tanpa userId)
  const guestOrderResult = await createOrder({
    customerName: "Tamu Tanpa Registrasi",
    customerPhone: "081299990001",
    serviceType: "TAKEAWAY",
    paymentMethod: "QRIS",
    userId: null,
    items: [
      {
        productId: "prod-kopi-01",
        name: "Kopi Sanger Aceh",
        unitPrice: 12000,
        quantity: 2,
        options: [],
      },
    ],
  });
  assert(guestOrderResult.success === true && !!guestOrderResult.orderNumber, "Guest checkout berhasil tanpa kewajiban registrasi akun.");

  // B. Registered Customer Checkout (dengan userId)
  const regCust = regResult.user!;
  const registeredOrderResult = await createOrder({
    customerName: regCust.name,
    customerPhone: regCust.phone,
    serviceType: "DINE_IN",
    tableNumber: "01",
    paymentMethod: "CASH",
    userId: regCust.id,
    items: [
      {
        productId: "prod-kopi-01",
        name: "Kopi Sanger Aceh",
        unitPrice: 12000,
        quantity: 1,
        options: [],
      },
    ],
  });
  assert(registeredOrderResult.success === true && !!registeredOrderResult.orderNumber, "Pesanan Customer Terdaftar berhasil dibuat dan mengaitkan userId.");

  // --------------------------------------------------------------------------
  // Ringkasan
  // --------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TOTAL PENGUJIAN: ${passed + failed} | BERHASIL: ${passed} | GAGAL: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error during tests:", err);
  process.exit(1);
});
