import { NextRequest, NextResponse } from "next/server";
import { createOrReuseSnapSession } from "@/actions/payments";
import { checkApiRateLimit } from "@/lib/security/order-guard";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "unknown";
    const rate = checkApiRateLimit(`snap:${ip}`, 20, 60_000);
    if (!rate.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan pembayaran. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
        },
        { status: 429 },
      );
    }

    const body = await req.json();
    const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: "Nomor pesanan wajib disertakan." },
        { status: 400 },
      );
    }

    const result = await createOrReuseSnapSession(orderNumber);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          alreadyPaid: result.alreadyPaid ?? false,
          error: result.error || "Gagal memproses pembayaran.",
        },
        { status: result.statusCode ?? 400 },
      );
    }

    return NextResponse.json({
      success: true,
      token: result.token,
      redirectUrl: result.redirectUrl,
      clientKey: result.clientKey,
      isProduction: result.isProduction,
      isSimulation: result.isSimulation ?? false,
    });
  } catch (err) {
    console.error("[Snap Route Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memproses pembayaran.",
      },
      { status: 500 },
    );
  }
}
