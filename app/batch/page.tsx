"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface Contact {
  id: string;
  name: string;
  phone?: string;
  nextPaymentAmount?: string | null;
  courtDate?: string | null;
}

type CallType = "payment" | "court";

const PAYMENT_TEMPLATE =
  "This is Alpha Bail Bonds. You have an outstanding balance of [AMOUNT] due by [DEADLINE]. Please call us or pay online: [LINK]";
const COURT_TEMPLATE =
  "This is Alpha Bail Bonds. You have a court appearance on [DATE]. You MUST appear or a warrant will be issued. Call us with any questions.";

const MAX_BATCH = 40;

const ASSISTANT_OPTIONS = [
  { value: "payment", label: "💳 Payment Reminder Assistant" },
  { value: "court", label: "⚖️ Court Date Reminder Assistant" },
];

export default function BatchCallerPage() {
  const router = useRouter();

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Call config
  const [callType, setCallType] = useState<CallType>("payment");
  const [messageTemplate, setMessageTemplate] = useState(PAYMENT_TEMPLATE);
  const [selectedAssistant, setSelectedAssistant] = useState<CallType>("payment");

  // Payment fields
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  // Court fields
  const [courtDate, setCourtDate] = useState("");

  // Scheduling
  const [startTime, setStartTime] = useState("");

  // Call window
  const [callWindowStart, setCallWindowStart] = useState("10:00");
  const [callWindowEnd, setCallWindowEnd] = useState("18:00");
  const [allowSaturday, setAllowSaturday] = useState(false);
  const [allowSunday, setAllowSunday] = useState(false);

  // Submission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch contacts on mount
  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await fetch("/api/contacts");
        if (res.ok) {
          const json = await res.json();
          setContacts(json.data ?? []);
        }
      } catch {
        // silently fail
      }
    }
    fetchContacts();
  }, []);

  // Update template when call type changes
  useEffect(() => {
    setMessageTemplate(callType === "payment" ? PAYMENT_TEMPLATE : COURT_TEMPLATE);
  }, [callType]);

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));

  function toggleContact(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredContacts.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredContacts.forEach((c) => next.add(c.id));
        return next;
      });
    }
  }

  const selectedCount = selectedIds.size;
  const isOverMax = selectedCount > MAX_BATCH;
  const canSubmit = selectedCount > 0 && !isOverMax && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      // Send original template; per-contact substitution happens in the API
      const res = await fetch("/api/batch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selectedIds),
          callType,
          assistantType: selectedAssistant,
          messageTemplate,
          paymentLink: callType === "payment" ? paymentLink : undefined,
          amount: callType === "payment" ? amount : undefined,
          deadline: callType === "payment" ? deadline : undefined,
          courtDate: callType === "court" ? courtDate : undefined,
          startTime: startTime || undefined,
          callWindowStart,
          callWindowEnd,
          allowSaturday,
          allowSunday,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Failed to launch batch.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-8">Batch Caller</h1>

        {error && (
          <p className="mb-6 text-red-400 text-sm font-medium">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {/* Contact Selection + Preview Panels */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Contacts
            </label>
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            {/* Three scroll windows */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

              {/* Window 1: Contact checkbox list */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
                <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/80 rounded-t-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Select All ({filteredContacts.length})
                    </span>
                  </label>
                </div>
                <div className="h-64 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="px-4 py-3 text-gray-400 text-sm">No contacts found</p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <label
                        key={contact.id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600 flex-shrink-0"
                        />
                        <span className="text-sm text-white truncate">{contact.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Window 2: Payment amounts preview */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
                <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/80 rounded-t-lg">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    💳 Payment Amounts
                  </span>
                </div>
                <div className="h-64 overflow-y-auto">
                  {selectedCount === 0 ? (
                    <p className="px-4 py-3 text-gray-500 text-xs italic">Select contacts to preview</p>
                  ) : (
                    contacts
                      .filter((c) => selectedIds.has(c.id))
                      .map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 last:border-0"
                        >
                          <span className="text-sm text-white truncate mr-2">{contact.name}</span>
                          <span className={`text-sm flex-shrink-0 font-medium ${contact.nextPaymentAmount ? 'text-green-400' : 'text-gray-500 italic'}`}>
                            {contact.nextPaymentAmount || 'not set'}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Window 3: Court dates preview */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
                <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/80 rounded-t-lg">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    ⚖️ Court Dates
                  </span>
                </div>
                <div className="h-64 overflow-y-auto">
                  {selectedCount === 0 ? (
                    <p className="px-4 py-3 text-gray-500 text-xs italic">Select contacts to preview</p>
                  ) : (
                    contacts
                      .filter((c) => selectedIds.has(c.id))
                      .map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 last:border-0"
                        >
                          <span className="text-sm text-white truncate mr-2">{contact.name}</span>
                          <span className={`text-sm flex-shrink-0 font-medium ${contact.courtDate ? 'text-blue-400' : 'text-gray-500 italic'}`}>
                            {contact.courtDate
                              ? new Date(contact.courtDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'not set'}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>

            {/* Selection count */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {selectedCount} of {contacts.length} selected
              </span>
              {isOverMax && (
                <span className="text-sm text-red-400 font-medium">(max {MAX_BATCH})</span>
              )}
            </div>
          </div>

          {/* Call Type Radio */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Call Type
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCallType("payment")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  callType === "payment"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                Payment Reminder
              </button>
              <button
                type="button"
                onClick={() => setCallType("court")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  callType === "court"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                Court Date Reminder
              </button>
            </div>
          </div>

          {/* AI Assistant Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Voice Assistant
            </label>
            <p className="text-xs text-gray-500 mb-3">Choose which pre-built Vapi assistant makes the calls for this batch.</p>
            <div className="flex gap-3">
              {ASSISTANT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedAssistant(opt.value as CallType)}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${
                    selectedAssistant === opt.value
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Template */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SMS Message Template
            </label>
            <textarea
              rows={4}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          {/* Conditional Inputs - Payment */}
          {callType === "payment" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Link
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          )}

          {/* Conditional Inputs - Court */}
          {callType === "court" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Court Date
              </label>
              <input
                type="date"
                value={courtDate}
                onChange={(e) => setCourtDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Batch Start Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Call Window */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-300 mb-1">Call Window (Eastern Time)</p>
              <p className="text-xs text-gray-500 mb-3">Calls outside this window will automatically roll to the next valid day.</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Open</label>
                  <input
                    type="time"
                    value={callWindowStart}
                    onChange={(e) => setCallWindowStart(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  />
                </div>
                <span className="text-gray-500 mt-5">to</span>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Close</label>
                  <input
                    type="time"
                    value={callWindowEnd}
                    onChange={(e) => setCallWindowEnd(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">Allow calls on weekends?</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSaturday}
                    onChange={(e) => setAllowSaturday(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-gray-300">Saturday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSunday}
                    onChange={(e) => setAllowSunday(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-gray-300">Sunday</span>
                </label>
              </div>
            </div>
          </div>

          {/* Launch Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Launching..." : "Launch Batch"}
          </button>
        </form>
      </main>
    </div>
  );
}
