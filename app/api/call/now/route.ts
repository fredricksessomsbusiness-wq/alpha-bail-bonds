import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleVapiCall } from "@/lib/vapi";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { contactId, callType, amount, deadline, courtDate, paymentLink } = await request.json();

    if (!contactId || !callType) {
      return NextResponse.json(
        { success: false, error: "contactId and callType are required" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }
    if (contact.agentId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Resolve assistant ID based on call type
    const assistantId =
      callType === "payment"
        ? process.env.VAPI_PAYMENT_ASSISTANT_ID
        : process.env.VAPI_COURT_ASSISTANT_ID;

    // Create call record
    const callRecord = await prisma.call.create({
      data: {
        contactId: contact.id,
        agentId: userId,
        callType,
        scheduledAt: new Date(),
        status: "in_progress",
      },
    });

    // Fire Vapi call immediately
    const vapiResult = await scheduleVapiCall({
      phoneNumber: contact.phone,
      contactName: contact.name,
      defendantName: contact.defendantName,
      callType,
      assistantId,
      amount: amount || contact.nextPaymentAmount || undefined,
      deadline: deadline || undefined,
      courtDate:
        courtDate ||
        (contact.courtDate
          ? new Date(contact.courtDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : undefined),
      paymentLink: paymentLink || undefined,
    });

    if (vapiResult.success && vapiResult.callId) {
      await prisma.call.update({
        where: { id: callRecord.id },
        data: { vapiCallId: vapiResult.callId },
      });
      // Update contact last contacted
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastContactedAt: new Date() },
      });
      return NextResponse.json({ success: true, data: { callId: vapiResult.callId, callRecordId: callRecord.id } });
    } else {
      await prisma.call.update({
        where: { id: callRecord.id },
        data: { status: "failed", outcome: "failed" },
      });
      return NextResponse.json(
        { success: false, error: vapiResult.error || "Vapi call failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("POST /api/call/now error:", error);
    return NextResponse.json({ success: false, error: "Failed to place call" }, { status: 500 });
  }
}
