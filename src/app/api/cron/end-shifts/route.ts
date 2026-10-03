import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/services/container";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Verify secret if set in production
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get("dateStr") || undefined;

    const services = getServices();
    const result = await services.cron.runCronJob("end-shifts", { dateStr });

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Cron /api/cron/end-shifts error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
