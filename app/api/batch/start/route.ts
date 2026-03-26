import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/vonage";
import { validateCallTime, getNextValidCallTime } from "@/lib/call-protection";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      contactIds,
      callType,
      messageTemplate,
      paymentLink,
      startTime,
    } = await request.json();

    if (
      !contactIds ||
      !Array.isArray(contactIds) ||
      contactIds.length === 0 ||
      !callType ||
      !messageTemplate ||
      !startTime
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "contactIds, callType, messageTemplate, and startTime are required",
        },
        { status: 400 }
      );
    }

    // Verify all contacts belong to this agent
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds as string[] },
        agentId: userId,
      },
    });

    if (contacts.length !== contactIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more contacts not found or not owned by agent" },
        { status: 400 }
      );
    }

    // Create batch campaign
    const batch = await prisma.batchCampaign.create({
      data: {
        agentId: userId,
        name: `${callType === "payment" ? "Payment" : "Court"} Batch - ${new Date().toLocaleDateString()}`,
        callType,
        messageTemplate,
        paymentLink: paymentLink || null,
        startTime: new Date(startTime),
        totalCalls: contacts.length,
        status: "running",
      },
    });

    // Send SMS to ALL contacts immediately
    for (const contact of contacts) {
      try {
        const smsResult = await sendSMS(contact.phone, messageTemplate);
        await prisma.textMessage.create({
          data: {
            contactId: contact.id,
            agentId: userId,
            body: messageTemplate,
            direction: "outbound",
            vonageMessageId: smsResult.messageId,
            status: smsResult.success ? "sent" : "failed",
          },
        });
      } catch (smsError) {
        console.error(`Failed to send SMS to ${contact.id}:`, smsError);
      }
    }

    // Create BatchCallQueue entries scheduled 30 min apart starting at startTime
    let currentTime = new Date(startTime);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Validate and adjust call time
      const validation = validateCallTime(currentTime);
      if (!validation.valid) {
        currentTime = getNextValidCallTime(currentTime);
      }

      await prisma.batchCallQueue.create({
        data: {
          batchId: batch.id,
          contactId: contact.id,
          scheduledAt: currentTime,
          status: "pending",
        },
      });

      // Next call 30 minutes later
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return NextResponse.json({
      success: true,
      data: { batchId: batch.id, totalContacts: contacts.length },
    });
  } catch (error) {
    console.error("POST /api/batch/start error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start batch campaign" },
      { status: 500 }
    );
  }
}
