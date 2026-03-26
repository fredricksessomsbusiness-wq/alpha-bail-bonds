import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { message } = body;

    // Only process end-of-call-report
    if (message?.type !== "end-of-call-report") {
      return NextResponse.json({ success: true });
    }

    const {
      call: vapiCall,
      transcript,
      summary,
      recordingUrl,
    } = message;

    const vapiCallId = vapiCall?.id;
    const duration = vapiCall?.duration;
    const vapiStatus = vapiCall?.status;

    if (!vapiCallId) {
      console.error("Vapi webhook: missing vapiCallId");
      return NextResponse.json({ success: true });
    }

    // Find the call record by vapiCallId
    const call = await prisma.call.findFirst({
      where: { vapiCallId },
    });

    if (!call) {
      console.error(`Vapi webhook: no Call found for vapiCallId ${vapiCallId}`);
      return NextResponse.json({ success: true });
    }

    // Map Vapi status to outcome
    let outcome: string;
    switch (vapiStatus) {
      case "ended":
        outcome = "answered";
        break;
      case "no-answer":
        outcome = "no_answer";
        break;
      case "voicemail":
        outcome = "voicemail";
        break;
      case "busy":
        outcome = "busy";
        break;
      default:
        outcome = "failed";
    }

    // Derive sentiment from summary if available
    const sentiment = summary?.toLowerCase().includes("positive")
      ? "positive"
      : summary?.toLowerCase().includes("negative")
        ? "negative"
        : "neutral";

    // Update Call record
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "completed",
        outcome,
        transcript,
        summary,
        recordingUrl,
        duration,
      },
    });

    // Update Contact
    await prisma.contact.update({
      where: { id: call.contactId },
      data: {
        lastOutcome: outcome,
        lastSentiment: sentiment,
        lastContactedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/webhooks/vapi error:", error);
    // Always return 200 for webhooks to prevent retries
    return NextResponse.json({ success: true });
  }
}
