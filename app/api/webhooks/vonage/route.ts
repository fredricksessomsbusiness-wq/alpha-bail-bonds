import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/vonage";

const AGENT_FORWARD_PHONE = process.env.AGENT_FORWARD_PHONE || "";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { msisdn, to, text } = body;

    if (!msisdn || !text) {
      return NextResponse.json({ success: true });
    }

    // Match contact by last 10 digits of phone
    const last10 = msisdn.slice(-10);

    const contact = await prisma.contact.findFirst({
      where: {
        phone: { endsWith: last10 },
      },
    });

    if (contact) {
      // Save inbound message
      await prisma.textMessage.create({
        data: {
          contactId: contact.id,
          agentId: contact.agentId,
          body: text,
          direction: "inbound",
        },
      });

      // Forward to agent phone
      if (AGENT_FORWARD_PHONE) {
        const forwardMessage = `Inbound from ${contact.name} (${contact.phone}): ${text}`;
        await sendSMS(AGENT_FORWARD_PHONE, forwardMessage);
      }
    } else {
      console.warn(`Vonage webhook: no contact found for phone ending in ${last10}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/webhooks/vonage error:", error);
    // Always return 200 for webhooks to prevent retries
    return NextResponse.json({ success: true });
  }
}
