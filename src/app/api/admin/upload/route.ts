import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/user-service";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

function sanitizeBaseName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "menu"
  );
}

/**
 * Upload foto produk menu oleh Admin ke folder `public/images/menu/`.
 * Dilindungi autentikasi JWT role ADMIN.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Hanya Admin yang diizinkan." }, { status: 403 });
  }

  const user = await getUserById(session.sub);
  if (user && !user.isActive) {
    return NextResponse.json({ error: "Akun Admin tidak aktif." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File gambar tidak ditemukan." }, { status: 400 });
    }

    const ext = ALLOWED_MIME_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau AVIF." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 2 MB." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base = sanitizeBaseName(file.name);
    const filename = `${base}-${Date.now().toString(36)}${ext}`;
    const targetDir = path.join(process.cwd(), "public", "images", "menu");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, filename), bytes);

    return NextResponse.json({ url: `/images/menu/${filename}` });
  } catch (err) {
    console.error("[api/admin/upload] Gagal mengunggah gambar:", err);
    return NextResponse.json({ error: "Gagal menyimpan file gambar di server." }, { status: 500 });
  }
}
