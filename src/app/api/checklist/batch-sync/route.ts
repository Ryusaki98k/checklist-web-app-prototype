import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/services/container";

export const dynamic = "force-dynamic";

/**
 * POST /api/checklist/batch-sync
 * Endpoint for syncing batched checklist toggles.
 * Supports standard JSON requests, keepalive fetch requests on unload,
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

    const items = body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: true, count: 0, results: [] });
    }

    // Format items for service call
    const formattedItems = items.map((item: any) => ({
      taskId: typeof item.taskId === "string" ? item.taskId : undefined,
      taskWorkId: typeof item.taskWorkId === "string" ? item.taskWorkId : undefined,
      shiftSessionId: typeof item.shiftSessionId === "string" ? item.shiftSessionId : undefined,
      completed: Boolean(item.completed),
      comment: typeof item.comment === "string" ? item.comment : undefined,
    }));

    const services = getServices();
    const result = await services.checklist.batchToggleTaskWorks(formattedItems);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Checklist batch-sync API route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
