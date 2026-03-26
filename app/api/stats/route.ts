import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Counts
    const [callsThisMonth, textsThisMonth, allTimeCalls, allTimeTexts] =
      await Promise.all([
        prisma.call.count({
          where: { agentId: userId, createdAt: { gte: startOfMonth } },
        }),
        prisma.textMessage.count({
          where: { agentId: userId, sentAt: { gte: startOfMonth } },
        }),
        prisma.call.count({
          where: { agentId: userId },
        }),
        prisma.textMessage.count({
          where: { agentId: userId },
        }),
      ]);

    // Active batches
    const activeBatches = await prisma.batchCampaign.findMany({
      where: { agentId: userId, status: { in: ["running", "pending"] } },
    });

    const activeBatchesWithProgress = activeBatches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      callType: batch.callType,
      totalCalls: batch.totalCalls,
      completedCalls: batch.completedCalls,
      status: batch.status,
      progress: batch.totalCalls > 0 ? Math.round((batch.completedCalls / batch.totalCalls) * 100) : 0,
      createdAt: batch.createdAt,
    }));

    // Recent activity: last 20 calls + texts combined, sorted by date desc
    const [recentCalls, recentTexts] = await Promise.all([
      prisma.call.findMany({
        where: { agentId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { contact: { select: { id: true, name: true, phone: true } } },
      }),
      prisma.textMessage.findMany({
        where: { agentId: userId },
        orderBy: { sentAt: "desc" },
        take: 20,
        include: { contact: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    const recentActivity = [
      ...recentCalls.map((c) => ({
        type: "call" as const,
        id: c.id,
        contactId: c.contact?.id,
        contactName: c.contact?.name,
        contactPhone: c.contact?.phone,
        status: c.status,
        outcome: c.outcome,
        sentiment: c.sentiment,
        summary: c.summary,
        transcript: c.transcript,
        recordingUrl: c.recordingUrl,
        duration: c.duration,
        callType: c.callType,
        date: c.createdAt,
      })),
      ...recentTexts.map((t) => ({
        type: "text" as const,
        id: t.id,
        contactId: t.contact?.id,
        contactName: t.contact?.name,
        contactPhone: t.contact?.phone,
        status: t.status,
        direction: t.direction,
        message: t.body,
        date: t.sentAt,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      data: {
        callsThisMonth,
        textsThisMonth,
        allTimeCalls,
        allTimeTexts,
        activeBatches: activeBatchesWithProgress,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
