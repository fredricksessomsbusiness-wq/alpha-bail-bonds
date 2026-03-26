import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: userId },
      select: { forwardPhone: true, forwardingEnabled: true },
    });

    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error("GET /api/agent/settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { forwardPhone, forwardingEnabled } = await request.json();

    const agent = await prisma.agent.update({
      where: { id: userId },
      data: {
        forwardPhone: forwardPhone || null,
        forwardingEnabled: !!forwardingEnabled,
      },
      select: { forwardPhone: true, forwardingEnabled: true },
    });

    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error("PUT /api/agent/settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
  }
}
