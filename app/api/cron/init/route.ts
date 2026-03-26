import { NextResponse } from "next/server";

// On Netlify: batch processing is handled by the scheduled function in
// netlify/functions/batch-processor.mts (runs every 2 minutes automatically).
// This endpoint is a no-op in production and a manual trigger in local dev.

export async function GET() {
  try {
    const isNetlify = !!process.env.NETLIFY;

    if (isNetlify) {
      return NextResponse.json({
        success: true,
        data: { status: "netlify_scheduled_function_active" },
      });
    }

    // Local dev: run the processor once manually
    const { processBatchQueue } = await import("@/lib/batch-processor");
    const result = await processBatchQueue();

    return NextResponse.json({
      success: true,
      data: { status: "processed", ...result },
    });
  } catch (error) {
    console.error("GET /api/cron/init error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run batch processor" },
      { status: 500 }
    );
  }
}
