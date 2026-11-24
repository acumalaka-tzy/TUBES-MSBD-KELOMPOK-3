import { NextResponse } from "next/server";
import { checkDistributedDatabaseStatus } from "@/lib/db/distributed";

export async function GET() {
  try {
    const status = await checkDistributedDatabaseStatus();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cluster: status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memeriksa status distributed database",
      },
      { status: 500 }
    );
  }
}
