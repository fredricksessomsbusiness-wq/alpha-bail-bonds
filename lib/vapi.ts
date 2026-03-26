interface VapiCallParams {
  phoneNumber: string;
  contactName: string;
  defendantName: string;
  callType: "payment" | "court";
  amount?: string;
  deadline?: string;
  courtDate?: string;
  paymentLink?: string;
  assistantId?: string; // optional override — if not provided, uses env var for callType
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

    // Resolve which pre-built assistant to use
    const assistantId =
      params.assistantId ||
      (params.callType === "payment"
        ? process.env.VAPI_PAYMENT_ASSISTANT_ID
        : process.env.VAPI_COURT_ASSISTANT_ID);

    if (!assistantId) {
      return {
        success: false,
        error: `No Vapi assistant ID configured for call type: ${params.callType}. Set VAPI_PAYMENT_ASSISTANT_ID or VAPI_COURT_ASSISTANT_ID in env vars.`,
      };
    }

    // Normalize phone to E.164 format with + prefix (required by Vapi)
    const digits = params.phoneNumber.replace(/\D/g, "");
    const toNumber =
      digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : `+${digits}`;

    // Variable values injected into the assistant's system prompt
    // In your Vapi assistant, reference these as {{contactName}}, {{amount}}, etc.
    const variableValues: Record<string, string> = {
      contactName: params.contactName || "valued client",
      defendantName: params.defendantName || params.contactName || "the defendant",
      amount: params.amount || "the outstanding balance",
      deadline: params.deadline || "as soon as possible",
      paymentLink: params.paymentLink || "",
      courtDate: params.courtDate || "your scheduled court date",
    };

    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId,
        assistantId,
        assistantOverrides: {
          variableValues,
          firstMessage: `Hello, may I speak with ${params.contactName}?`,
        },
        customer: {
          number: toNumber,
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
