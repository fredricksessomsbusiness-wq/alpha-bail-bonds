import { prisma } from "./prisma";
import { scheduleVapiCall } from "./vapi";

/**
 * Processes pending batch call queue entries.
 * Called by the Netlify Scheduled Function every 2 minutes.
 * Can also be invoked directly for local testing via /api/cron/init.
 */
export async function processBatchQueue(): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  try {
    // Find pending queue items that are due
    const dueItems = await prisma.batchCallQueue.findMany({
      where: {
        scheduledAt: { lte: now },
        status: "pending",
      },
      include: {
        contact: true,
        batch: true,
      },
      take: 10,
    });

    for (const item of dueItems) {
      try {
        await prisma.batchCallQueue.update({
          where: { id: item.id },
          data: { status: "calling" },
        });

        const call = await prisma.call.create({
          data: {
            contactId: item.contactId,
            agentId: item.batch.agentId,
            callType: item.batch.callType,
            scheduledAt: item.scheduledAt,
            status: "in_progress",
          },
        });

        const result = await scheduleVapiCall({
          phoneNumber: item.contact.phone,
          contactName: item.contact.name,
          defendantName: item.contact.defendantName,
          callType: item.batch.callType as "payment" | "court",
        });

        if (result.success && result.callId) {
          await prisma.call.update({
            where: { id: call.id },
            data: { vapiCallId: result.callId },
          });
          await prisma.batchCallQueue.update({
            where: { id: item.id },
            data: { status: "completed", callId: call.id },
          });
        } else {
          await prisma.call.update({
            where: { id: call.id },
            data: { status: "failed", outcome: "failed" },
          });

          if (item.attempt < 3) {
            await prisma.batchCallQueue.update({
              where: { id: item.id },
              data: {
                status: "pending",
                attempt: item.attempt + 1,
                scheduledAt: new Date(now.getTime() + 30 * 60 * 1000),
              },
            });
          } else {
            await prisma.batchCallQueue.update({
              where: { id: item.id },
              data: { status: "failed", callId: call.id },
            });
          }
        }

        // Update batch campaign progress
        const completedCount = await prisma.batchCallQueue.count({
          where: { batchId: item.batchId, status: { in: ["completed", "failed"] } },
        });
        const totalCount = await prisma.batchCallQueue.count({
          where: { batchId: item.batchId },
        });

        await prisma.batchCampaign.update({
          where: { id: item.batchId },
          data: {
            completedCalls: completedCount,
            status: completedCount >= totalCount ? "completed" : "running",
          },
        });

        processed++;
      } catch (itemError) {
        console.error(`Error processing queue item ${item.id}:`, itemError);
        await prisma.batchCallQueue.update({
          where: { id: item.id },
          data: { status: "failed" },
        }).catch(() => {});
        errors++;
      }
    }
  } catch (error) {
    console.error("Batch processor error:", error);
    errors++;
  }

  return { processed, errors };
}
