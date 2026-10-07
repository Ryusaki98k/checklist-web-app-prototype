import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/services/container";
import { Role } from "@/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/manager/approve-session
 * Endpoint for resilient shift session approvals.
 * Supports standard JSON requests, keepalive fetch requests on page unload,
 * and navigator.sendBeacon requests.
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const rawText = await request.text();
      if (!rawText || rawText.trim() === "") {
        return NextResponse.json({ success: true, count: 0 });
      }
      body = JSON.parse(rawText);
    }

    const services = getServices();

    // Support single approval or batched approvals
    const items: Array<{
      shiftSessionId: string;
      role: "manager" | "manager_assistant" | "committee" | "general_manager" | Role;
      isException?: boolean;
    }> = [];

    if (Array.isArray(body?.items)) {
      items.push(...body.items);
    } else if (body?.shiftSessionId) {
      items.push({
        shiftSessionId: body.shiftSessionId,
        role: body.role || "manager",
        isException: Boolean(body.isException),
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ success: true, count: 0, results: [] });
    }

    const results: Array<{
      shiftSessionId: string;
      success: boolean;
      targetUserId?: string;
      error?: string;
    }> = [];
    for (const item of items) {
      if (!item.shiftSessionId) continue;
      try {
        const res = await services.manager.approveShiftSession({
          shiftSessionId: item.shiftSessionId,
          role: item.role || "manager",
          isException: Boolean(item.isException),
        });
        results.push({
          shiftSessionId: item.shiftSessionId,
          ...res,
        });
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Failed to approve shift session";
        results.push({
          shiftSessionId: item.shiftSessionId,
          success: false,
          error: errMessage,
        });
      }
    }

    const allSuccessful = results.every((r) => r.success);
    const targetUserId = results.find((r) => Boolean(r.targetUserId))?.targetUserId;

    return NextResponse.json({
      success: allSuccessful,
      targetUserId,
      results,
    });
  } catch (error: unknown) {
    console.error("Manager approve-session API route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
