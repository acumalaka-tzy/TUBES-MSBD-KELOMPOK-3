"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/admin/audit";
import {
  authenticateUser,
  createSession,
  deleteSession,
  findUserByIdentifier,
  getSession,
  registerNewUser,
  getDefaultRedirectForRole,
  type AuthUser,
  type UserRole,
  INITIAL_MOCK_USERS,
} from "@/lib/auth";
import { validateIndonesianWhatsApp } from "@/lib/auth/phone-validation";
import { sendOtpEmail } from "@/lib/email/mailer";
import {
  savePendingRegistration,
  getPendingRegistration,
  updatePendingOtp,
  removePendingRegistration,
  generateOtpCode,
} from "@/lib/email/otp-store";

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
  user?: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    role: UserRole;
  };
}

/**
 * Server Action: Login Pengguna
 */
export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const identifier = (formData.get("identifier") as string) || "";
  const password = (formData.get("password") as string) || "";
  const redirectTarget = (formData.get("redirect") as string) || "";

  if (!identifier.trim()) {
    return { success: false, error: "Email atau nomor WhatsApp wajib diisi." };
  }
  if (!password) {
    return { success: false, error: "Password wajib diisi." };
  }

  const authResult = await authenticateUser(identifier, password);
  if (!authResult.user || authResult.error) {
    const attempted = await findUserByIdentifier(identifier);
    if (attempted?.role === "ADMIN") {
      await recordAuditLog({
        actorId: attempted.id,
        actorName: attempted.name,
        actorRole: attempted.role,
        entityName: "users",
        entityId: attempted.id,
        action: "ADMIN_LOGIN_FAILED",
        oldData: null,
        newData: { identifier: identifier.trim(), attemptedAt: new Date().toISOString() },
        reason: authResult.error || "Percobaan login Admin gagal (password tidak valid).",
      });
    }
    return {
      success: false,
      error: authResult.error || "Gagal masuk. Periksa kembali kredensial Anda.",
    };
  }

  // Set HTTP-Only Session Cookie (JWT)
  await createSession(authResult.user);

  if (authResult.user.role === "ADMIN") {
    await recordAuditLog({
      actorId: authResult.user.id,
      actorName: authResult.user.name,
      actorRole: authResult.user.role,
      entityName: "users",
      entityId: authResult.user.id,
      action: "ADMIN_LOGIN",
      oldData: null,
      newData: {
        email: authResult.user.email,
        phone: authResult.user.phone,
        loginAt: new Date().toISOString(),
      },
      reason: "Admin masuk ke Dashboard setelah verifikasi password",
    });
  }

  try {
    revalidatePath("/");
  } catch {
    // Dipanggil di luar request context
  }

  const targetPath = redirectTarget && redirectTarget.startsWith("/")
    ? redirectTarget
    : getDefaultRedirectForRole(authResult.user.role);

  return {
    success: true,
    redirectTo: targetPath,
    user: {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      phone: authResult.user.phone,
      role: authResult.user.role,
    },
  };
}

/**
 * Server Action: Registrasi Customer Terdaftar dengan Verifikasi Email OTP Asli
 */
export async function registerAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const name = (formData.get("name") as string) || "";
  const email = (formData.get("email") as string) || "";
  const phone = (formData.get("phone") as string) || "";
  const password = (formData.get("password") as string) || "";
  const confirmPassword = (formData.get("confirmPassword") as string) || "";

  if (!name.trim()) {
    return { success: false, error: "Nama lengkap wajib diisi." };
  }
  if (!email.trim()) {
    return { success: false, error: "Email wajib diisi untuk verifikasi akun Anda." };
  }

  // Validasi format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { success: false, error: "Format email tidak valid. Gunakan format seperti nama@domain.com." };
  }

  // Validasi format WhatsApp Indonesia
  const phoneValidation = validateIndonesianWhatsApp(phone);
  if (!phoneValidation.isValid) {
    return { success: false, error: phoneValidation.error || "Nomor WhatsApp tidak valid." };
  }

  if (!password || password.length < 6) {
    return { success: false, error: "Password minimal 6 karakter." };
  }
  if (password !== confirmPassword) {
    return { success: false, error: "Konfirmasi password tidak cocok." };
  }

  // Cek apakah email atau nomor WhatsApp sudah terdaftar di database
  const cleanEmail = email.trim().toLowerCase();
  const existingByEmail = await findUserByIdentifier(cleanEmail);
  if (existingByEmail) {
    return { success: false, error: "Email sudah terdaftar. Silakan login atau gunakan email lain." };
  }

  const existingByPhone = await findUserByIdentifier(phoneValidation.normalized);
  if (existingByPhone) {
    return { success: false, error: "Nomor WhatsApp sudah terdaftar. Silakan login atau gunakan nomor lain." };
  }

  // Generate 6-digit OTP kriptografis
  const otpCode = generateOtpCode();

  // Simpan data registrasi sementara dalam pending store
  savePendingRegistration(
    {
      name: name.trim(),
      email: cleanEmail,
      phone: phoneValidation.normalized,
      passwordHash: password, // disimpan sementara dan di-hash aman saat verifikasi
    },
    otpCode
  );

  // Kirim email OTP asli menggunakan Gmail SMTP Warkop Agam
  const mailResult = await sendOtpEmail({
    toEmail: cleanEmail,
    recipientName: name.trim(),
    otpCode,
  });

  if (!mailResult.success) {
    return {
      success: false,
      error: `Gagal mengirim email kode verifikasi: ${mailResult.error || "Kesalahan SMTP"}. Pastikan email Anda aktif.`,
    };
  }

  return {
    success: true,
    redirectTo: `/verify-email?email=${encodeURIComponent(cleanEmail)}`,
  };
}

/**
 * Server Action: Verifikasi Kode OTP Email & Aktivasi Akun
 */
export async function verifyOtpAction(
  email: string,
  otpCode: string
): Promise<AuthActionResult> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanOtp = (otpCode || "").trim();

  if (!cleanEmail) {
    return { success: false, error: "Email tidak valid." };
  }
  if (!cleanOtp || cleanOtp.length !== 6) {
    return { success: false, error: "Masukkan 6 digit kode verifikasi OTP yang valid." };
  }

  const pending = getPendingRegistration(cleanEmail);
  if (!pending) {
    return {
      success: false,
      error: "Sesi verifikasi tidak ditemukan atau telah kedaluwarsa. Silakan lakukan pendaftaran ulang.",
    };
  }

  if (pending.otpCode !== cleanOtp) {
    return {
      success: false,
      error: "Kode OTP salah. Silakan periksa kembali email Anda.",
    };
  }

  // OTP Valid! Daftarkan user ke database secara permanen
  const regResult = await registerNewUser({
    name: pending.name,
    email: pending.email,
    phone: pending.phone,
    password: pending.passwordHash,
    role: "CUSTOMER",
  });

  if (!regResult.user || regResult.error) {
    return {
      success: false,
      error: regResult.error || "Gagal mengaktifkan akun. Silakan coba lagi.",
    };
  }

  // Hapus data registrasi pending
  removePendingRegistration(cleanEmail);

  // Otomatis login dengan sesi JWT aman
  await createSession(regResult.user);

  try {
    revalidatePath("/");
  } catch {
    // Abaikan
  }

  return {
    success: true,
    redirectTo: "/",
    user: {
      id: regResult.user.id,
      name: regResult.user.name,
      email: regResult.user.email,
      phone: regResult.user.phone,
      role: regResult.user.role,
    },
  };
}

/**
 * Server Action: Kirim Ulang Kode OTP Verifikasi Email
 */
export async function resendOtpAction(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: "Email tidak valid." };
  }

  const pending = getPendingRegistration(cleanEmail);
  if (!pending) {
    return {
      success: false,
      error: "Sesi verifikasi telah kedaluwarsa. Silakan daftar kembali.",
    };
  }

  const newOtp = generateOtpCode();
  updatePendingOtp(cleanEmail, newOtp);

  const mailResult = await sendOtpEmail({
    toEmail: pending.email,
    recipientName: pending.name,
    otpCode: newOtp,
  });

  if (!mailResult.success) {
    return {
      success: false,
      error: `Gagal mengirim ulang kode: ${mailResult.error || "Kesalahan SMTP"}.`,
    };
  }

  return {
    success: true,
    message: "Kode verifikasi baru telah berhasil dikirimkan ke email Anda.",
  };
}

/**
 * Server Action: Quick Demo Login untuk Pengujian & Evaluasi MSBD
 */
export async function quickDemoLoginAction(role: UserRole): Promise<AuthActionResult> {
  if (role === "ADMIN") {
    return {
      success: false,
      error: "Login Administrator wajib memasukkan email/WhatsApp dan password.",
    };
  }

  const targetMock = INITIAL_MOCK_USERS.find((u) => u.role === role);
  if (!targetMock) {
    return { success: false, error: `Role demo "${role}" tidak ditemukan.` };
  }

  const demoUser: AuthUser = {
    id: targetMock.id,
    name: targetMock.name,
    email: targetMock.email,
    phone: targetMock.phone,
    role: targetMock.role,
    isActive: true,
  };

  await createSession(demoUser);

  try {
    revalidatePath("/");
  } catch {
    // Abaikan
  }

  const targetPath = getDefaultRedirectForRole(role);
  return {
    success: true,
    redirectTo: targetPath,
    user: {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      phone: demoUser.phone,
      role: demoUser.role,
    },
  };
}

/**
 * Server Action: Logout
 */
export async function logoutAction(): Promise<void> {
  await deleteSession();
  try {
    revalidatePath("/");
  } catch {
    // Abaikan
  }
  redirect("/login");
}

/**
 * Server Action: Mendapatkan Pengguna Aktif
 */
export async function getCurrentUserAction() {
  const session = await getSession();
  if (!session) return null;

  return {
    id: session.sub,
    name: session.name,
    email: session.email || null,
    phone: session.phone,
    role: session.role,
  };
}

