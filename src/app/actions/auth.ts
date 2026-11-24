"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/admin/audit";
import {
  authenticateUser,
  consumePasswordResetToken,
  createSession,
  deleteSession,
  findUserByIdentifier,
  getSession,
  getUserById,
  getUserRecordById,
  issuePasswordResetToken,
  PASSWORD_RESET_EXPIRATION_MINUTES,
  registerNewUser,
  getDefaultRedirectForRole,
  updateUserPasswordHash,
  verifyPasswordResetToken,
  verifyUserPassword,
  type AuthUser,
  type UserRole,
  INITIAL_MOCK_USERS,
} from "@/lib/auth";
import { validateIndonesianWhatsApp } from "@/lib/auth/phone-validation";
import { sendOtpEmail, sendPasswordResetEmail } from "@/lib/email/mailer";
import { checkApiRateLimit, getClientIpSafe } from "@/lib/security/order-guard";
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

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "Jika email tersebut terdaftar di sistem Warkop Agam, tautan untuk mengatur ulang password telah dikirimkan ke kotak masuk Anda.";

/**
 * Server Action: Permintaan Lupa Password (Forgot Password)
 * Menggunakan token kriptografis berbatas waktu & sekali pakai tanpa membocorkan status keberadaan email.
 */
export async function requestPasswordResetAction(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return {
      success: false,
      error: "Masukkan alamat email yang valid (contoh: nama@domain.com).",
    };
  }

  const clientIp = await getClientIpSafe();
  const rate = checkApiRateLimit(`pwd-reset:${clientIp}:${cleanEmail}`, 5, 15 * 60_000);
  if (!rate.ok) {
    return {
      success: false,
      error: `Terlalu banyak permintaan reset password. Silakan coba lagi dalam ${Math.ceil(rate.retryAfterSeconds / 60)} menit.`,
    };
  }

  const user = await findUserByIdentifier(cleanEmail);
  if (user && user.is_active && user.email?.toLowerCase() === cleanEmail) {
    try {
      const { rawToken } = await issuePasswordResetToken(user.id);
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

      const mailRes = await sendPasswordResetEmail({
        toEmail: cleanEmail,
        recipientName: user.name,
        resetUrl,
        expiryMinutes: PASSWORD_RESET_EXPIRATION_MINUTES,
      });

      if (!mailRes.success) {
        console.warn("[auth:forgotPassword] Gagal mengirim email reset:", mailRes.error);
      }

      await recordAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        entityName: "users",
        entityId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        oldData: null,
        newData: {
          email: cleanEmail,
          requestedAt: new Date().toISOString(),
        },
        reason: "Pengguna mengajukan permintaan reset password melalui email",
      });
    } catch (err) {
      console.warn("[auth:forgotPassword] Error internal saat memproses token:", err);
    }
  }

  // Selalu kembalikan pesan generik agar tidak membocorkan apakah email terdaftar atau tidak
  return {
    success: true,
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
  };
}

/**
 * Server Action: Verifikasi Validitas Token Reset Password
 */
export async function validateResetTokenAction(token: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  const res = await verifyPasswordResetToken(token);
  return { valid: res.valid, error: res.error };
}

/**
 * Server Action: Atur Ulang Password Menggunakan Token Sekali Pakai
 */
export async function resetPasswordWithTokenAction(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const newPassword = input.newPassword || "";
  const confirmPassword = input.confirmPassword || "";

  if (!input.token?.trim()) {
    return { success: false, error: "Token reset password tidak ditemukan." };
  }
  if (newPassword.length < 6) {
    return { success: false, error: "Password baru minimal 6 karakter." };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Konfirmasi password baru tidak cocok." };
  }

  const consumeRes = await consumePasswordResetToken({
    rawToken: input.token,
    newPassword,
  });

  if (!consumeRes.success || !consumeRes.userId) {
    return {
      success: false,
      error: consumeRes.error || "Tautan reset password tidak valid atau sudah kedaluwarsa.",
    };
  }

  const user = await getUserById(consumeRes.userId);
  await recordAuditLog({
    actorId: consumeRes.userId,
    actorName: user?.name ?? null,
    actorRole: user?.role ?? "CUSTOMER",
    entityName: "users",
    entityId: consumeRes.userId,
    action: "PASSWORD_RESET_COMPLETED",
    oldData: null,
    newData: {
      resetAt: new Date().toISOString(),
      method: "EMAIL_TOKEN",
    },
    reason: "Pengguna menyelesaikan reset password melalui tautan pemulihan satu kali pakai",
  });

  return {
    success: true,
    message: "Password berhasil diatur ulang. Silakan masuk dengan password baru Anda.",
  };
}

/**
 * Server Action: Ubah Password oleh Pengguna Terautentikasi melalui Pengaturan Akun
 */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = await getSession();
  if (!session || !session.sub) {
    return {
      success: false,
      error: "Anda harus masuk terlebih dahulu untuk mengubah password.",
    };
  }

  const currentPassword = input.currentPassword || "";
  const newPassword = input.newPassword || "";
  const confirmPassword = input.confirmPassword || "";

  if (newPassword.length < 6) {
    return { success: false, error: "Password baru minimal 6 karakter." };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Konfirmasi password baru tidak cocok." };
  }

  const userRecord = await getUserRecordById(session.sub);
  if (!userRecord) {
    return { success: false, error: "Data akun tidak ditemukan." };
  }

  // Jika akun memiliki password sebelumnya, verifikasi password lama wajib valid
  if (userRecord.password_hash) {
    if (!currentPassword) {
      return { success: false, error: "Password lama wajib diisi." };
    }
    const isOldValid = await verifyUserPassword(currentPassword, userRecord.password_hash);
    if (!isOldValid) {
      await recordAuditLog({
        actorId: session.sub,
        actorName: session.name,
        actorRole: session.role,
        entityName: "users",
        entityId: session.sub,
        action: "CHANGE_PASSWORD_FAILED",
        oldData: null,
        newData: { attemptedAt: new Date().toISOString() },
        reason: "Verifikasi password lama gagal saat mencoba ubah password",
      });
      return { success: false, error: "Password lama yang Anda masukkan salah." };
    }
    if (currentPassword === newPassword) {
      return {
        success: false,
        error: "Password baru tidak boleh sama dengan password lama.",
      };
    }
  }

  const updateRes = await updateUserPasswordHash(session.sub, newPassword);
  if (!updateRes.success) {
    return { success: false, error: updateRes.error || "Gagal menyimpan password baru." };
  }

  await recordAuditLog({
    actorId: session.sub,
    actorName: session.name,
    actorRole: session.role,
    entityName: "users",
    entityId: session.sub,
    action: "CHANGE_PASSWORD",
    oldData: { hadPassword: Boolean(userRecord.password_hash) },
    newData: {
      changedAt: new Date().toISOString(),
      role: session.role,
    },
    reason: "Pengguna mengubah password melalui Pengaturan Akun",
  });

  try {
    revalidatePath("/account");
    revalidatePath("/admin");
  } catch {
    // Abaikan di luar Next.js request context
  }

  return {
    success: true,
    message: "Password akun Anda berhasil diperbarui dan dicatat dalam sistem keamanan.",
  };
}

