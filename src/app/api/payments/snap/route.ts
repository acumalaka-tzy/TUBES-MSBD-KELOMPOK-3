import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/actions/helpers";
import { createSnapTransaction } from "@/lib/midtrans";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderNumber = body.orderNumber;

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: "Nomor pesanan wajib disertakan." },
        { status: 400 }
      );
    }

    let customerName = "Pelanggan Warkop";
    let customerPhone = "-";
    let grossAmount = 0;
    let items: { id: string; price: number; quantity: number; name: string }[] = [];

    // 1. Cek di Database Prisma
    try {
      const order = await prisma.order.findUnique({
        where: { order_number: orderNumber },
        include: { items: true, payment: true },
      });

      if (order) {
        if (order.status === "CANCELLED" || (order.expires_at && new Date(order.expires_at) < new Date())) {
          return NextResponse.json(
            { success: false, error: "Batas waktu pembayaran telah habis (Kedaluwarsa). Meja telah dikosongkan." },
            { status: 400 }
          );
        }
        if (order.payment?.status === "PAID") {
          return NextResponse.json(
            { success: false, error: "Pesanan ini sudah lunas." },
            { status: 400 }
          );
        }

        customerName = order.customer_name;
        customerPhone = order.customer_phone || "-";
        grossAmount = Number(order.total_amount);
        items = order.items.map((it: any) => ({
          id: it.product_id || it.id,
          name: it.product_name_snapshot,
          price: it.subtotal ? Math.round(Number(it.subtotal) / it.quantity) : Number(it.unit_price_snapshot),
          quantity: it.quantity,
        }));
      }
    } catch {
      // Fallback ke memory
    }

    // 2. Cek di Memory Fallback jika DB belum terisi
    if (grossAmount === 0) {
      const fallback = memoryOrders.get(orderNumber);
      if (fallback) {
        if (fallback.status === "CANCELLED" || (fallback.expires_at && new Date(fallback.expires_at) < new Date())) {
          return NextResponse.json(
            { success: false, error: "Batas waktu pembayaran telah habis (Kedaluwarsa). Meja telah dikosongkan." },
            { status: 400 }
          );
        }
        if (fallback.payment?.status === "PAID") {
          return NextResponse.json(
            { success: false, error: "Pesanan ini sudah lunas." },
            { status: 400 }
          );
        }

        customerName = fallback.customer_name;
        customerPhone = fallback.customer_phone || "-";
        grossAmount = Number(fallback.total_amount);
        items = fallback.items.map((it: any) => ({
          id: it.product_id || it.id,
          name: it.product_name_snapshot,
          price: it.subtotal ? Math.round(Number(it.subtotal) / it.quantity) : Number(it.unit_price_snapshot),
          quantity: it.quantity,
        }));
      }
    }

    if (grossAmount <= 0) {
      return NextResponse.json(
        { success: false, error: `Pesanan ${orderNumber} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const snapResult = await createSnapTransaction({
      orderNumber,
      customerName,
      customerPhone,
      grossAmount,
      items,
    });

    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const clientKey =
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
      process.env.MIDTRANS_CLIENT_KEY ||
      "";

    return NextResponse.json({
      success: true,
      token: snapResult.token,
      redirectUrl: snapResult.redirectUrl,
      clientKey,
      isProduction,
      isSimulation: snapResult.isSimulation ?? false,
    });
  } catch (err) {
    console.error("[Snap Route Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memproses pembayaran.",
      },
      { status: 500 }
    );
  }
}

