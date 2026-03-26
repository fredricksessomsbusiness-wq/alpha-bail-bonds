import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;

    const batch = await prisma.batchCampaign.findUnique({
      where: { id },
      include: {
        queue: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, error: "Batch campaign not found" },
        { status: 404 }
      );
    }

    if (batch.agentId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const statusCounts = {
      pending: 0,
      calling: 0,
      completed: 0,
      failed: 0,
      retry: 0,
    };

    for (const entry of batch.queue) {
      const s = entry.status as keyof typeof statusCounts;
      if (s in statusCounts) {
        statusCounts[s]++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: batch.id,
        name: batch.name,
        callType: batch.callType,
        status: batch.status,
        totalCalls: batch.totalCalls,
        completedCalls: batch.completedCalls,
        statusCounts,
        createdAt: batch.createdAt,
      },
    });
  } catch (error) {
    console.error("GET /api/batch/status/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch batch status" },
      { status: 500 }
    );
  }
}
