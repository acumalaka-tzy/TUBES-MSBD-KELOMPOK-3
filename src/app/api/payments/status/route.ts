import { NextRequest, NextResponse } from "next/server";
import { checkMidtransStatus } from "@/lib/midtrans";
import { applyMidtransPaymentUpdate } from "@/actions/payments";

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

    const statusData = await checkMidtransStatus(orderNumber);

    if (statusData && statusData.transaction_status) {
      const updateResult = await applyMidtransPaymentUpdate(orderNumber, {
        transaction_status: statusData.transaction_status,
        fraud_status: statusData.fraud_status,
        payment_type: statusData.payment_type,
        gross_amount: statusData.gross_amount,
        transaction_id: statusData.transaction_id,
        signature_verified: true,
        raw_payload: statusData as unknown as Record<string, unknown>,
      });

      return NextResponse.json({
        success: true,
        midtransStatus: statusData.transaction_status,
        paymentType: statusData.payment_type,
        paymentStatus: updateResult.paymentStatus,
        orderStatus: updateResult.orderStatus,
        message: `Status Midtrans: ${statusData.transaction_status} (${updateResult.paymentStatus})`,
      });
    }

    return NextResponse.json({
      success: true,
      midtransStatus: "pending",
      paymentStatus: "UNPAID",
      orderStatus: "PENDING",
      message: "Menunggu transaksi diproses atau diselesaikan di Midtrans.",
    });
  } catch (err) {
    console.error("[Payment Status Route Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal mengecek status pembayaran.",
      },
      { status: 500 }
    );
  }
}

