import { NextRequest, NextResponse } from "next/server";
import { verifyMidtransSignature, getMidtransConfig } from "@/lib/midtrans";
import { applyMidtransPaymentUpdate } from "@/actions/payments";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orderId = body.order_id;
    const statusCode = body.status_code;
    const grossAmount = body.gross_amount;
    const signatureKey = body.signature_key;
    const transactionStatus = body.transaction_status;
    const fraudStatus = body.fraud_status;
    const paymentType = body.payment_type;
    const transactionId = body.transaction_id;

    if (!orderId || !transactionStatus) {
      return NextResponse.json(
        { error: "Invalid payload: missing order_id or transaction_status" },
        { status: 400 }
      );
    }

    // Verifikasi Signature jika serverKey tersedia
    const config = getMidtransConfig();
    const hasRealKey =
      Boolean(config.serverKey) &&
      !config.serverKey.includes("your_") &&
      !config.serverKey.includes("sample_key");

    let isSignatureValid = false;
    if (hasRealKey && signatureKey) {
      isSignatureValid = verifyMidtransSignature({
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
      });

      if (!isSignatureValid) {
        console.warn(`[Midtrans Webhook] Invalid signature key for order ${orderId}`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      // Pada mode development / simulasi sandbox tanpa key riil
      isSignatureValid = true;
    }

    // Terapkan perubahan status transaksi ke database & store
    const updateResult = await applyMidtransPaymentUpdate(orderId, {
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      payment_type: paymentType,
      gross_amount: grossAmount,
      transaction_id: transactionId,
      signature_verified: isSignatureValid,
      raw_payload: body,
    });

    return NextResponse.json({
      status: "OK",
      order_id: orderId,
      transaction_status: transactionStatus,
      payment_status: updateResult.paymentStatus,
      order_status: updateResult.orderStatus,
    });
  } catch (error) {
    console.error("[Midtrans Webhook] Error processing notification:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

