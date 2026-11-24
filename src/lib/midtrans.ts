import crypto from "crypto";

export interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  snapApiUrl: string;
  coreApiUrl: string;
}

export function getMidtransConfig(): MidtransConfig {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const clientKey =
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    process.env.MIDTRANS_CLIENT_KEY ||
    "";

  return {
    serverKey,
    clientKey,
    isProduction,
    snapApiUrl: isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions",
    coreApiUrl: isProduction
      ? "https://api.midtrans.com/v2"
      : "https://api.sandbox.midtrans.com/v2",
  };
}

export interface SnapTransactionParams {
  orderNumber: string;
  gatewayOrderId?: string;
  grossAmount: number;
  customerName: string;
  customerPhone?: string;
  items?: {
    id: string;
    price: number;
    quantity: number;
    name: string;
  }[];
}

export interface SnapResponse {
  token: string;
  redirectUrl: string;
  gatewayOrderId: string;
  isSimulation?: boolean;
}

function isDuplicateMidtransOrderIdError(errText: string): boolean {
  const lower = errText.toLowerCase();
  return (
    lower.includes("sudah digunakan") ||
    lower.includes("already been used") ||
    lower.includes("has already been taken")
  );
}

/**
 * Buat Snap Transaction Token melalui API Midtrans
 */
export async function createSnapTransaction(
  params: SnapTransactionParams
): Promise<SnapResponse> {
  const config = getMidtransConfig();
  const baseGatewayOrderId = (params.gatewayOrderId || params.orderNumber).slice(0, 50);

  // Jika Server Key belum diset atau masih dummy, gunakan mode simulasi yang aman
  const isDummyKey =
    !config.serverKey ||
    config.serverKey.includes("your_") ||
    config.serverKey.includes("sample_key");

  if (isDummyKey) {
    const mockToken = `snap-token-sim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return {
      token: mockToken,
      redirectUrl: "",
      gatewayOrderId: baseGatewayOrderId,
      isSimulation: true,
    };
  }

  const authHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`;

  const roundedGrossAmount = Math.round(params.grossAmount);
  let itemDetails: { id: string; price: number; quantity: number; name: string }[] = [];

  if (params.items && params.items.length > 0) {
    const rawItems = params.items.map((it) => ({
      id: String(it.id).substring(0, 50),
      price: Math.round(Number(it.price) || 0),
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      name: String(it.name || "Menu").substring(0, 50),
    }));

    const sumItems = rawItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const diff = roundedGrossAmount - sumItems;

    if (diff === 0) {
      itemDetails = rawItems;
    } else if (diff > 0) {
      // Tambahkan penyesuaian selisih agar total sama persis dengan gross_amount
      itemDetails = [
        ...rawItems,
        {
          id: "FEE-ADJUSTMENT",
          name: "Penyesuaian Nominal",
          price: diff,
          quantity: 1,
        },
      ];
    } else {
      // Jika selisih minus, satukan menjadi single line agar 100% match dengan gross_amount
      itemDetails = [
        {
          id: params.orderNumber.substring(0, 50),
          name: `Total Pesanan ${params.orderNumber}`.substring(0, 50),
          price: roundedGrossAmount,
          quantity: 1,
        },
      ];
    }
  } else {
    itemDetails = [
      {
        id: params.orderNumber.substring(0, 50),
        name: `Total Pesanan ${params.orderNumber}`.substring(0, 50),
        price: roundedGrossAmount,
        quantity: 1,
      },
    ];
  }

  const maxAttempts = 3;
  let lastErrorText = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = `${Date.now().toString(36).slice(-4).toUpperCase()}${attempt}`;
    const gatewayOrderId =
      attempt === 0
        ? baseGatewayOrderId
        : `${params.orderNumber.slice(0, 50 - suffix.length - 1)}-${suffix}`;

    const payload = {
      transaction_details: {
        order_id: gatewayOrderId,
        gross_amount: roundedGrossAmount,
      },
      customer_details: {
        first_name: params.customerName,
        phone: params.customerPhone || "-",
      },
      item_details: itemDetails,
      credit_card: {
        secure: true,
      },
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders/${params.orderNumber}`,
      },
    };

    const res = await fetch(config.snapApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = (await res.json()) as { token: string; redirect_url: string };
      return {
        token: data.token,
        redirectUrl: data.redirect_url,
        gatewayOrderId,
        isSimulation: false,
      };
    }

    lastErrorText = await res.text();
    if (!isDuplicateMidtransOrderIdError(lastErrorText)) {
      console.warn(`[Midtrans] Gagal membuat Snap transaction (${res.status}):`, lastErrorText);
      throw new Error(`Midtrans Error: ${lastErrorText}`);
    }
    console.warn(
      `[Midtrans] order_id "${gatewayOrderId}" sudah digunakan, mencoba ulang dengan ID sesi baru...`,
    );
  }

  throw new Error(`Midtrans Error: ${lastErrorText}`);
}

export interface MidtransStatusResponse {
  status_code: string;
  status_message: string;
  transaction_id?: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: string;
  fraud_status?: string;
  signature_key?: string;
  settlement_time?: string;
}

/**
 * Cek status transaksi langsung ke Midtrans API
 */
export async function checkMidtransStatus(
  orderNumber: string
): Promise<MidtransStatusResponse | null> {
  const config = getMidtransConfig();

  const isDummyKey =
    !config.serverKey ||
    config.serverKey.includes("your_") ||
    config.serverKey.includes("sample_key");

  if (isDummyKey) {
    return null;
  }

  const authHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`;
  const url = `${config.coreApiUrl}/${orderNumber}/status`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as MidtransStatusResponse;
  } catch (err) {
    console.warn(`[Midtrans] Gagal cek status ${orderNumber}:`, err);
    return null;
  }
}

/**
 * Verifikasi signature notifikasi webhook dari Midtrans
 * Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  const config = getMidtransConfig();
  if (!config.serverKey) return false;

  const rawString = `${payload.order_id}${payload.status_code}${payload.gross_amount}${config.serverKey}`;
  const expectedSignature = crypto
    .createHash("sha512")
    .update(rawString)
    .digest("hex");

  return expectedSignature.toLowerCase() === payload.signature_key.toLowerCase();
}

/**
 * Pemetaan status transaksi Midtrans ke status internal sistem
 */
export function mapMidtransStatusToInternal(
  transactionStatus: string,
  fraudStatus?: string
): {
  paymentStatus: "PAID" | "UNPAID" | "FAILED" | "CANCELLED";
  orderStatus: "CONFIRMED" | "PENDING" | "CANCELLED";
} {
  const status = transactionStatus.toLowerCase();

  if (status === "capture") {
    if (fraudStatus === "challenge") {
      return { paymentStatus: "UNPAID", orderStatus: "PENDING" };
    }
    return { paymentStatus: "PAID", orderStatus: "CONFIRMED" };
  }

  if (status === "settlement") {
    return { paymentStatus: "PAID", orderStatus: "CONFIRMED" };
  }

  if (status === "pending") {
    return { paymentStatus: "UNPAID", orderStatus: "PENDING" };
  }

  if (status === "deny" || status === "cancel" || status === "expire" || status === "failure") {
    return { paymentStatus: "FAILED", orderStatus: "CANCELLED" };
  }

  return { paymentStatus: "UNPAID", orderStatus: "PENDING" };
}

