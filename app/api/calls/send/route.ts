import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/vonage";
import { scheduleVapiCall } from "@/lib/vapi";
import { validateCallTime } from "@/lib/call-protection";

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
      contactId,
      callType,
      messageTemplate,
      paymentLink,
      amount,
      deadline,
      courtDate,
      scheduleCall,
      scheduledAt,
    } = await request.json();

    if (!contactId || !callType || !messageTemplate) {
      return NextResponse.json(
        { success: false, error: "contactId, callType, and messageTemplate are required" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    if (contact.agentId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Always send SMS immediately
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

    let callRecord = null;

    if (scheduleCall) {
      if (!scheduledAt) {
        return NextResponse.json(
          { success: false, error: "scheduledAt is required when scheduleCall is true" },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(scheduledAt);
      const validation = validateCallTime(scheduledDate);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.reason },
          { status: 400 }
        );
      }

      callRecord = await prisma.call.create({
        data: {
          contactId: contact.id,
          agentId: userId,
          callType,
          status: "scheduled",
          scheduledAt: scheduledDate,
        },
      });

      const vapiResult = await scheduleVapiCall({
        phoneNumber: contact.phone,
        contactName: contact.name,
        defendantName: contact.defendantName,
        callType,
        amount,
        deadline,
        courtDate,
        paymentLink,
      });

      if (vapiResult.success && vapiResult.callId) {
        callRecord = await prisma.call.update({
          where: { id: callRecord.id },
          data: { vapiCallId: vapiResult.callId, status: "in_progress" },
        });
      } else {
        callRecord = await prisma.call.update({
          where: { id: callRecord.id },
          data: { status: "failed", outcome: "failed" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        smsSent: smsResult.success,
        call: callRecord,
      },
    });
  } catch (error) {
    console.error("POST /api/calls/send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send call" },
      { status: 500 }
    );
  }
}
