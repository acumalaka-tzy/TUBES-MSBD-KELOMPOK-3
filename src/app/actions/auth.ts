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
 * Server Action: Registrasi Customer Terdaftar
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
  if (!phone.trim()) {
    return { success: false, error: "Nomor WhatsApp aktif wajib diisi." };
  }
  if (!password || password.length < 6) {
    return { success: false, error: "Password minimal 6 karakter." };
  }
  if (password !== confirmPassword) {
    return { success: false, error: "Konfirmasi password tidak cocok." };
  }

  const regResult = await registerNewUser({
    name,
    email: email.trim() || null,
    phone,
    password,
    role: "CUSTOMER",
  });

  if (!regResult.user || regResult.error) {
    return {
      success: false,
      error: regResult.error || "Gagal mendaftarkan akun. Silakan coba lagi.",
    };
  }

  // Otomatis login setelah registrasi
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
 * Server Action: Autentikasi Menggunakan Akun Google (Login / Register)
 */
export async function googleAuthAction(redirectTarget?: string): Promise<AuthActionResult> {
  try {
    const googleEmail = "pelanggan.google@gmail.com";
    const googleName = "Pelanggan Google Warkop";
    const googlePhone = "081299887766";

    let user = await findUserByIdentifier(googleEmail);

    if (!user) {
      const registerRes = await registerNewUser({
        name: googleName,
        email: googleEmail,
        phone: googlePhone,
        password: "google_oauth_dummy_pass_msbd",
        role: "CUSTOMER",
      });

      if (!registerRes.user) {
        return { success: false, error: registerRes.error || "Gagal membuat akun Google." };
      }

      user = {
        id: registerRes.user.id,
        name: registerRes.user.name,
        email: registerRes.user.email,
        phone: registerRes.user.phone,
        password_hash: "",
        role: registerRes.user.role,
        is_active: registerRes.user.isActive,
      };
    }

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: true,
    });

    try {
      revalidatePath("/");
    } catch {
      // Abaikan di luar context
    }

    const target = redirectTarget && redirectTarget.startsWith("/") ? redirectTarget : "/";

    return {
      success: true,
      redirectTo: target,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: "Gagal memproses autentikasi Google: " + (err?.message || "Terjadi kesalahan"),
    };
  }
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

