/**
 * Validasi dan normalisasi nomor WhatsApp format Indonesia
 * Standar: Dimulai dengan 08, 628, atau +628, dengan panjang 10 - 14 digit angka.
 */
export function validateIndonesianWhatsApp(phone: string): {
  isValid: boolean;
  normalized: string;
  error?: string;
} {
  const clean = phone.trim().replace(/[\s-]/g, "");

  if (!clean) {
    return {
      isValid: false,
      normalized: "",
      error: "Nomor WhatsApp wajib diisi.",
    };
  }

  // Regex: mendukung 08..., 628..., atau +628... dengan panjang total 10-14 digit
  const indonesianPhoneRegex = /^(\+?62|0)8[1-9][0-9]{7,11}$/;

  if (!indonesianPhoneRegex.test(clean)) {
    return {
      isValid: false,
      normalized: clean,
      error: "Nomor WhatsApp tidak valid. Gunakan format Indonesia (contoh: 081234567890 atau 6281234567890, 10-14 digit).",
    };
  }

  // Normalisasi menjadi 08...
  let normalized = clean;
  if (normalized.startsWith("+62")) {
    normalized = "0" + normalized.slice(3);
  } else if (normalized.startsWith("62")) {
    normalized = "0" + normalized.slice(2);
  }

  return {
    isValid: true,
    normalized,
  };
}

