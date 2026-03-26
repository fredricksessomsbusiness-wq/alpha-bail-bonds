import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/vonage";

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

    const { contactId, message } = await request.json();

    if (!contactId || !message) {
      return NextResponse.json(
        { success: false, error: "contactId and message are required" },
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

    const smsResult = await sendSMS(contact.phone, message);

    const textMessage = await prisma.textMessage.create({
      data: {
        contactId: contact.id,
        agentId: userId,
        body: message,
        direction: "outbound",
        vonageMessageId: smsResult.messageId,
        status: smsResult.success ? "sent" : "failed",
      },
    });

    return NextResponse.json({ success: true, data: textMessage });
  } catch (error) {
    console.error("POST /api/sms/send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}
