import { NextRequest, NextResponse } from "next/server";
import { checkMidtransStatusAction } from "@/actions/payments";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: "Nomor pesanan wajib disertakan." },
        { status: 400 },
      );
    }

    const res = await checkMidtransStatusAction(orderNumber);
    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || "Gagal mengecek status pembayaran." },
        { status: 500 },
      );
    }

    return NextResponse.json(res);
  } catch (err) {
    console.error("[Payment Status Route Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal mengecek status pembayaran.",
      },
      { status: 500 },
    );
  }
}

