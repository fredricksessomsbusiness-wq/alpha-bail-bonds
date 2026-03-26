import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/vonage";
import { validateCallTime, getNextValidCallTime, DEFAULT_CALL_WINDOW, type CallWindowConfig } from "@/lib/call-protection";

function resolveTemplate(template: string, contact: { nextPaymentAmount?: string | null; courtDate?: Date | null }, globals: { amount?: string; deadline?: string; courtDate?: string; paymentLink?: string }): string {
  const amount = contact.nextPaymentAmount || globals.amount || '[AMOUNT]';
  const deadline = globals.deadline || (contact.courtDate ? new Date(contact.courtDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '') || '[DEADLINE]';
  const courtDate = contact.courtDate ? new Date(contact.courtDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : globals.courtDate || '[DATE]';
  const link = globals.paymentLink || '[LINK]';
  return template
    .replace(/\[AMOUNT\]/g, amount)
    .replace(/\[DEADLINE\]/g, deadline)
    .replace(/\[DATE\]/g, courtDate)
    .replace(/\[LINK\]/g, link);
}

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
      assistantType,
      messageTemplate,
      paymentLink,
      amount,
      deadline,
      courtDate,
      startTime,
      callWindowStart,
      callWindowEnd,
      allowSaturday,
      allowSunday,
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

    // Store assistantType alongside callType (e.g. "payment:payment" or "court:court" or "payment:court")
    // Format: "{callType}:{assistantType}" — batch processor splits this to know which assistant to use
    const resolvedAssistantType = assistantType || callType;
    const batchCallType = `${callType}:${resolvedAssistantType}`;

    // Create batch campaign
    const batch = await prisma.batchCampaign.create({
      data: {
        agentId: userId,
        name: `${callType === "payment" ? "Payment" : "Court"} Batch - ${new Date().toLocaleDateString()}`,
        callType: batchCallType,
        messageTemplate,
        paymentLink: paymentLink || null,
        startTime: new Date(startTime),
        totalCalls: contacts.length,
        status: "running",
      },
    });

    // Send SMS to ALL contacts immediately, with per-contact substitution
    const globals = { amount, deadline, courtDate, paymentLink };
    for (const contact of contacts) {
      try {
        const resolvedMessage = resolveTemplate(messageTemplate, contact, globals);
        const smsResult = await sendSMS(contact.phone, resolvedMessage);
        await prisma.textMessage.create({
          data: {
            contactId: contact.id,
            agentId: userId,
            body: resolvedMessage,
            direction: "outbound",
            vonageMessageId: smsResult.messageId,
            status: smsResult.success ? "sent" : "failed",
          },
        });
      } catch (smsError) {
        console.error(`Failed to send SMS to ${contact.id}:`, smsError);
      }
    }

    // Build call window config from form values (fallback to defaults)
    const parseTime = (val: string | undefined, defaultHour: number, defaultMin: number) => {
      if (!val) return { hour: defaultHour, minute: defaultMin };
      const [h, m] = val.split(":").map(Number);
      return { hour: isNaN(h) ? defaultHour : h, minute: isNaN(m) ? defaultMin : m };
    };
    const windowStart = parseTime(callWindowStart, DEFAULT_CALL_WINDOW.startHour, DEFAULT_CALL_WINDOW.startMinute);
    const windowEnd = parseTime(callWindowEnd, DEFAULT_CALL_WINDOW.endHour, DEFAULT_CALL_WINDOW.endMinute);

    const callWindow: CallWindowConfig = {
      startHour: windowStart.hour,
      startMinute: windowStart.minute,
      endHour: windowEnd.hour,
      endMinute: windowEnd.minute,
      allowSaturday: !!allowSaturday,
      allowSunday: !!allowSunday,
    };

    // Minutes available per day in the window
    const windowMinutes =
      (callWindow.endHour * 60 + callWindow.endMinute) -
      (callWindow.startHour * 60 + callWindow.startMinute);

    // Space calls so they fit comfortably — at least 30 min, but scale up if window is tight
    const BUFFER_MINUTES = Math.max(30, Math.ceil(windowMinutes / Math.max(contacts.length, 1)));

    // Create BatchCallQueue entries spaced BUFFER_MINUTES apart, rolling to next valid day as needed
    let currentTime = getNextValidCallTime(new Date(startTime), callWindow);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      await prisma.batchCallQueue.create({
        data: {
          batchId: batch.id,
          contactId: contact.id,
          scheduledAt: currentTime,
          status: "pending",
        },
      });

      // Advance to next slot, then validate/roll forward into the window
      const next = new Date(currentTime.getTime() + BUFFER_MINUTES * 60 * 1000);
      currentTime = getNextValidCallTime(next, callWindow);
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
