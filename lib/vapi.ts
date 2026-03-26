interface VapiCallParams {
  phoneNumber: string;
  contactName: string;
  defendantName: string;
  callType: "payment" | "court";
  amount?: string;
  deadline?: string;
  courtDate?: string;
  paymentLink?: string;
}

export async function scheduleVapiCall(
  params: VapiCallParams
): Promise<{ success: boolean; callId?: string; error?: string }> {
  try {
    const apiKey = process.env.VAPI_API_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!apiKey || !phoneNumberId) {
      return { success: false, error: "Vapi credentials not configured" };
    }

    let systemPrompt: string;

    if (params.callType === "payment") {
      systemPrompt = `You are a professional collections assistant calling on behalf of a bail bonds company. You are calling ${params.contactName} regarding a balance owed. Be firm but professional. State the amount owed: ${params.amount || "the outstanding balance"}. State the deadline: ${params.deadline || "as soon as possible"}. ${params.paymentLink ? "Mention they can pay online at their convenience." : ""} Try to get a verbal commitment to pay. If they give excuses, pushback, or become hostile, say "I understand. A representative will follow up with you directly." Keep the call under 2 minutes. Do not argue. Do not threaten. Be direct and professional.`;
    } else {
      systemPrompt = `You are a professional assistant calling on behalf of a bail bonds company. You are calling ${params.contactName} to remind them about an upcoming court date. State the court date: ${params.courtDate || "their scheduled court date"}. Emphasize that they MUST appear or a warrant will be issued for their arrest. Try to get verbal confirmation that they will attend. If they express confusion or resistance, say "A representative will follow up with you directly." Keep the call under 2 minutes. Be direct and professional.`;
    }

    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId,
        customer: {
          number: params.phoneNumber.replace(/\D/g, ""),
        },
        assistant: {
          firstMessage: `Hello, may I speak with ${params.contactName}?`,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Vapi API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, callId: data.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Vapi error";
    return { success: false, error: message };
  }
}
