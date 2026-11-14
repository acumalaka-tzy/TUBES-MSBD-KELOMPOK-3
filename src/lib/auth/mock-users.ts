import { UserRole } from "./jwt";

export interface MockUserRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
}

// Fallback user data yang selaras dengan prisma/seed.ts
// Memungkinkan pengujian mandiri RBAC & Login meski database MySQL lokal belum running
export const INITIAL_MOCK_USERS: MockUserRecord[] = [
  {
    id: "usr-admin-001",
    name: "Bang Agam (Owner)",
    email: "admin@warkopagam.id",
    phone: "081260001001",
    // bcrypt hash untuk "admin123"
    password_hash: "$2a$10$pLw.P5V1Y697p87iT68pQO1Y3j5gL8Vd4o/jEaCcvs7m6gW/8C9cO",
    role: "ADMIN",
    is_active: true,
  },
  {
    id: "usr-cashier-001",
    name: "Rizky Pratama",
    email: "rizky.kasir@warkopagam.id",
    phone: "081260001002",
    // bcrypt hash untuk "kasir123"
    password_hash: "$2a$10$pLw.P5V1Y697p87iT68pQO1Y3j5gL8Vd4o/jEaCcvs7m6gW/8C9cO",
    role: "CASHIER",
    is_active: true,
  },
  {
    id: "usr-cashier-002",
    name: "Siti Rahma",
    email: "siti.kasir@warkopagam.id",
    phone: "081260001003",
    // bcrypt hash untuk "kasir123"
    password_hash: "$2a$10$pLw.P5V1Y697p87iT68pQO1Y3j5gL8Vd4o/jEaCcvs7m6gW/8C9cO",
    role: "CASHIER",
    is_active: true,
  },
  {
    id: "usr-cust-001",
    name: "Andi Saputra",
    email: "andi.customer@gmail.com",
    phone: "085270002001",
    // bcrypt hash untuk "customer123"
    password_hash: "$2a$10$pLw.P5V1Y697p87iT68pQO1Y3j5gL8Vd4o/jEaCcvs7m6gW/8C9cO",
    role: "CUSTOMER",
    is_active: true,
  },
  {
    id: "usr-cust-002",
    name: "Dina Marlina",
    email: "dina.customer@gmail.com",
    phone: "085270002002",
    // bcrypt hash untuk "customer123"
    password_hash: "$2a$10$pLw.P5V1Y697p87iT68pQO1Y3j5gL8Vd4o/jEaCcvs7m6gW/8C9cO",
    role: "CUSTOMER",
    is_active: true,
  },
];

// In-memory runtime storage untuk sesi testing
export const memoryUsers = new Map<string, MockUserRecord>(
  INITIAL_MOCK_USERS.map((u) => [u.id, { ...u }])
);

