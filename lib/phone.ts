/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * - 10 digits → +1XXXXXXXXXX
 * - 11 digits starting with 1 → +1XXXXXXXXXX
 * - Already has + → strip non-digits and re-add +
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already E.164 or international — just ensure + prefix
  return `+${digits}`;
}
