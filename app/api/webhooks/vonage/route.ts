import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/vonage";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { msisdn, text } = body;

    if (!msisdn || !text) {
      return NextResponse.json({ success: true });
    }

    // Match contact by last 10 digits of phone
    const last10 = msisdn.slice(-10);

    const contact = await prisma.contact.findFirst({
      where: { phone: { endsWith: last10 } },
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

      // Look up agent forwarding settings from database
      const agent = await prisma.agent.findUnique({
        where: { id: contact.agentId },
        select: { forwardPhone: true, forwardingEnabled: true },
      });

      if (agent?.forwardingEnabled && agent.forwardPhone) {
        const forwardMessage = `📩 ${contact.name} (${contact.phone}): ${text}`;
        await sendSMS(agent.forwardPhone, forwardMessage);
      }
    } else {
      console.warn(`Vonage webhook: no contact found for phone ending in ${last10}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/webhooks/vonage error:", error);
    // Always return 200 to prevent Vonage retries
    return NextResponse.json({ success: true });
  }
}
