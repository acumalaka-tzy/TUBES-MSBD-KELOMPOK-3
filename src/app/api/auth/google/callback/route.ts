import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  let redirectTarget = "/";
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
      if (parsed.redirect && typeof parsed.redirect === "string" && parsed.redirect.startsWith("/")) {
        redirectTarget = parsed.redirect;
      }
    } catch {
      // Abaikan jika state tidak bisa di-parse
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error || "Akses Google dibatalkan")}`, appUrl)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=" + encodeURIComponent("Konfigurasi GOOGLE_CLIENT_ID atau SECRET belum lengkap di .env"), appUrl)
    );
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  try {
    // 1. Tukar authorization code dengan access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(tokenData.error_description || "Gagal menukar token dengan Google")}`,
          appUrl
        )
      );
    }

    // 2. Ambil profil pengguna asli dari Google
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await profileResponse.json();
    if (!profileResponse.ok || !googleUser.email) {
      return NextResponse.redirect(
        new URL("/login?error=" + encodeURIComponent("Gagal mengambil data profil dari Google"), appUrl)
      );
    }

    const email = googleUser.email.toLowerCase().trim();
    const name = googleUser.name || googleUser.given_name || "Pelanggan Google";

    // 3. Sinkronkan pengguna ke database MySQL (dengan fallback aman)
    let user: { id: string; name: string; email: string | null; phone: string; role: string; is_active: boolean } | null = null;
    try {
      user = await prisma.user.findFirst({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name,
            email,
            phone: "-",
            role: "CUSTOMER",
            is_active: true,
          },
        });
      }
    } catch (dbErr) {
      console.warn("Koneksi DB untuk Google User gagal, fallback ke sesi akun Google:", dbErr);
      user = {
        id: "usr-google-" + Math.random().toString(36).substring(2, 9),
        name,
        email,
        phone: "-",
        role: "CUSTOMER",
        is_active: true,
      };
    }

    // 4. Buat sesi JWT HTTP-Only
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as any,
      isActive: user.is_active,
    });

    // 5. Arahkan kembali ke halaman tujuan
    return NextResponse.redirect(new URL(redirectTarget, appUrl));
  } catch (err: any) {
    console.error("Google OAuth Callback Error:", err);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Terjadi kesalahan saat memproses login Google: " + (err.message || ""))}`, appUrl)
    );
  }
}

