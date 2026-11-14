import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "./password";
import { AuthUser, UserRole } from "./jwt";
import { memoryUsers, MockUserRecord } from "./mock-users";

export interface RegisterUserInput {
  name: string;
  email?: string | null;
  phone: string;
  password: string;
  role?: UserRole;
}

/**
 * Validasi password apakah cocok dengan hash (mendukung bcrypt asli dan placeholder prisma/seed.ts)
 */
async function verifyUserPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;

  // Placeholder non-bcrypt dari prisma/seed.ts sebelum diubah admin
  if (hash.startsWith("$2b$12$examplehashedpasswordadmin")) {
    return password === "admin123";
  }
  if (hash.startsWith("$2b$12$examplehashedpasswordcashier")) {
    return password === "kasir123";
  }
  if (hash.startsWith("$2b$12$examplehashedpasswordcust")) {
    return password === "customer123" || password === "password123";
  }

  // Verifikasi bcrypt standar
  try {
    return await comparePassword(password, hash);
  } catch {
    return false;
  }
}

/**
 * Mencari user berdasarkan Email atau Nomor Telepon
 */
export async function findUserByIdentifier(identifier: string): Promise<MockUserRecord | null> {
  const cleanId = identifier.trim().toLowerCase();

  // 1. Coba cari di MySQL via Prisma
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanId },
          { phone: identifier.trim() },
        ],
      },
    });

    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        password_hash: user.password_hash || "",
        role: user.role as UserRole,
        is_active: user.is_active,
      };
    }
  } catch (error) {
    console.warn("Koneksi Prisma User gagal, beralih ke in-memory fallback:", error);
  }

  // 2. Fallback memory users
  for (const user of memoryUsers.values()) {
    if (
      user.email?.toLowerCase() === cleanId ||
      user.phone === identifier.trim()
    ) {
      return user;
    }
  }

  return null;
}

/**
 * Verifikasi login dengan identifier (email/no HP) dan password
 */
export async function authenticateUser(
  identifier: string,
  password: string
): Promise<{ user: AuthUser | null; error?: string }> {
  if (!identifier?.trim()) {
    return { user: null, error: "Email atau nomor telepon wajib diisi." };
  }
  if (!password) {
    return { user: null, error: "Password wajib diisi." };
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return { user: null, error: "Akun tidak ditemukan. Silakan periksa kembali email atau nomor telepon Anda." };
  }

  if (!user.is_active) {
    return { user: null, error: "Akun Anda dinonaktifkan. Silakan hubungi pengelola restoran." };
  }

  const isPasswordValid = await verifyUserPassword(password, user.password_hash);
  if (!isPasswordValid) {
    return { user: null, error: "Password yang Anda masukkan salah." };
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.is_active,
    },
  };
}

/**
 * Registrasi pengguna baru (default role: CUSTOMER)
 */
export async function registerNewUser(
  input: RegisterUserInput
): Promise<{ user: AuthUser | null; error?: string }> {
  const cleanName = input.name.trim();
  const cleanEmail = input.email ? input.email.trim().toLowerCase() : null;
  const cleanPhone = input.phone.trim();
  const role: UserRole = input.role || "CUSTOMER";

  if (!cleanName) {
    return { user: null, error: "Nama lengkap wajib diisi." };
  }
  if (!cleanPhone) {
    return { user: null, error: "Nomor WhatsApp aktif wajib diisi." };
  }
  if (!input.password || input.password.length < 6) {
    return { user: null, error: "Password minimal terdiri dari 6 karakter." };
  }

  // Cek duplikasi
  const existingUser = await findUserByIdentifier(cleanEmail || cleanPhone);
  if (existingUser) {
    return {
      user: null,
      error: "Email atau nomor telepon sudah terdaftar. Silakan login.",
    };
  }

  const hashedPassword = await hashPassword(input.password);
  const newId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  // Simpan ke Prisma jika tersedia
  try {
    const created = await prisma.user.create({
      data: {
        id: newId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        password_hash: hashedPassword,
        role: role,
        is_active: true,
      },
    });

    // Simpan juga ke in-memory agar konsisten
    memoryUsers.set(created.id, {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      password_hash: created.password_hash || hashedPassword,
      role: created.role as UserRole,
      is_active: created.is_active,
    });

    return {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        role: created.role as UserRole,
        isActive: created.is_active,
      },
    };
  } catch (error) {
    console.warn("Gagal membuat user di database Prisma, menggunakan memory store:", error);

    // Fallback simpan ke memory
    const memoryRecord: MockUserRecord = {
      id: newId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      password_hash: hashedPassword,
      role: role,
      is_active: true,
    };
    memoryUsers.set(newId, memoryRecord);

    return {
      user: {
        id: memoryRecord.id,
        name: memoryRecord.name,
        email: memoryRecord.email,
        phone: memoryRecord.phone,
        role: memoryRecord.role,
        isActive: memoryRecord.is_active,
      },
    };
  }
}

/**
 * Ambil data user lengkap berdasarkan ID
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as UserRole,
        isActive: user.is_active,
      };
    }
  } catch {
    // Abaikan dan coba memory
  }

  const memoryRecord = memoryUsers.get(userId);
  if (memoryRecord) {
    return {
      id: memoryRecord.id,
      name: memoryRecord.name,
      email: memoryRecord.email,
      phone: memoryRecord.phone,
      role: memoryRecord.role,
      isActive: memoryRecord.is_active,
    };
  }

  return null;
}

