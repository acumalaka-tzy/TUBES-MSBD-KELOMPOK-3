import crypto from "crypto";

export interface PendingUserRegistration {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  otpCode: string;
  expiresAt: number; // timestamp ms
  createdAt: number;
}

// Global in-memory storage untuk registrasi pending (bertahan selama lifecycle server)
const pendingRegistrations = new Map<string, PendingUserRegistration>();

// Masa berlaku OTP: 15 menit
export const OTP_EXPIRATION_MS = 15 * 60 * 1000;

export function generateOtpCode(): string {
  // Generate 6 digit angka aman kriptografis (100000 - 999999)
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

export function savePendingRegistration(
  data: Omit<PendingUserRegistration, "otpCode" | "expiresAt" | "createdAt">,
  otpCode: string
): PendingUserRegistration {
  const cleanEmail = data.email.trim().toLowerCase();
  const now = Date.now();
  const pendingData: PendingUserRegistration = {
    ...data,
    email: cleanEmail,
    otpCode,
    createdAt: now,
    expiresAt: now + OTP_EXPIRATION_MS,
  };

  pendingRegistrations.set(cleanEmail, pendingData);
  return pendingData;
}

export function getPendingRegistration(email: string): PendingUserRegistration | null {
  const cleanEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations.get(cleanEmail);
  if (!pending) return null;

  // Cek apakah sudah kedaluwarsa
  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(cleanEmail);
    return null;
  }

  return pending;
}

export function updatePendingOtp(email: string, newOtpCode: string): PendingUserRegistration | null {
  const cleanEmail = email.trim().toLowerCase();
  const existing = pendingRegistrations.get(cleanEmail);
  if (!existing) return null;

  const now = Date.now();
  existing.otpCode = newOtpCode;
  existing.expiresAt = now + OTP_EXPIRATION_MS;
  pendingRegistrations.set(cleanEmail, existing);
  return existing;
}

export function removePendingRegistration(email: string): void {
  const cleanEmail = email.trim().toLowerCase();
  pendingRegistrations.delete(cleanEmail);
}

