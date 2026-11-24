import { UserRole } from "./jwt";

export interface MockUserRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  deleted_at?: Date | null;
}

// Fallback user data yang selaras dengan prisma/seed.ts
// Memungkinkan pengujian mandiri RBAC & Login meski database MySQL lokal belum running
// Catatan: Sesuai aturan bisnis, hanya boleh ada 1 akun ADMIN yang aktif (usr-admin-001).
export const INITIAL_MOCK_USERS: MockUserRecord[] = [
  {
    id: "usr-admin-001",
    name: "Admin Agam (Owner)",
    email: "adminAgam@gmail.com",
    phone: "081260001001",
    // bcrypt hash untuk "admin123"
    password_hash: "$2b$10$I6kXNF9zntOmY7wOGB7lzunxeD.YINMFS0CbcXkL4t99xwmv1rsiW",
    role: "ADMIN",
    is_active: true,
    deleted_at: null,
  },
  {
    id: "usr-cashier-001",
    name: "Kasir Shift Pagi Sore",
    email: "cashier@gmail.com",
    phone: "0898777621",
    // bcrypt hash untuk "kasir123"
    password_hash: "$2b$10$wo03NfpO26M5m5p.yYfx1.TMccZxwRiMLwxAi3SzqC8awICMk2SxW",
    role: "CASHIER",
    is_active: true,
    deleted_at: null,
  },
  {
    id: "usr-cashier-002",
    name: "Kasir Shift Sore Malam",
    email: "cashier1@gmail.com",
    phone: "0877663244",
    // bcrypt hash untuk "kasir123"
    password_hash: "$2b$10$wo03NfpO26M5m5p.yYfx1.TMccZxwRiMLwxAi3SzqC8awICMk2SxW",
    role: "CASHIER",
    is_active: true,
    deleted_at: null,
  },
  {
    id: "usr-cust-001",
    name: "Andi Saputra",
    email: "andi.customer@gmail.com",
    phone: "085270002001",
    // bcrypt hash untuk "customer123"
    password_hash: "$2b$10$cs.wdW9YDAbo2DA1aadPUux2AE9TntWZmKz7p3f.Rz3pDRLC491Ey",
    role: "CUSTOMER",
    is_active: true,
    deleted_at: null,
  },
  {
    id: "usr-cust-002",
    name: "Dina Marlina",
    email: "dina.customer@gmail.com",
    phone: "085270002002",
    // bcrypt hash untuk "customer123"
    password_hash: "$2b$10$cs.wdW9YDAbo2DA1aadPUux2AE9TntWZmKz7p3f.Rz3pDRLC491Ey",
    role: "CUSTOMER",
    is_active: true,
    deleted_at: null,
  },
];

// In-memory runtime storage untuk sesi testing
export const memoryUsers = new Map<string, MockUserRecord>(
  INITIAL_MOCK_USERS.map((u) => [u.id, { ...u }])
);

