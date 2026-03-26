function normalizeToE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    const from = process.env.VONAGE_FROM_NUMBER;

    if (!apiKey || !apiSecret || !from) {
      return { success: false, error: "Vonage credentials not configured" };
    }

    const response = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        api_secret: apiSecret,
        from,
        to: normalizeToE164(to),
        text: message,
      }),
    });

    const data = await response.json();

    if (data.messages && data.messages[0]) {
      const msg = data.messages[0];
      if (msg.status === "0") {
        return { success: true, messageId: msg["message-id"] };
      }
      return { success: false, error: msg["error-text"] || "SMS send failed" };
    }

    return { success: false, error: "Unexpected Vonage response" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SMS error";
    return { success: false, error: message };
  }
}
