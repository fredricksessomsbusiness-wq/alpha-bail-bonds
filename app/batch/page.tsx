"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface Contact {
  id: string;
  name: string;
  phone?: string;
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
      // Resolve message with placeholders filled in
      let resolvedMessage = messageTemplate;
      if (callType === "payment") {
        resolvedMessage = resolvedMessage
          .replace(/\[AMOUNT\]/g, amount || "[AMOUNT]")
          .replace(/\[DEADLINE\]/g, deadline || "[DEADLINE]")
          .replace(/\[LINK\]/g, paymentLink || "[LINK]");
      } else {
        resolvedMessage = resolvedMessage.replace(/\[DATE\]/g, courtDate || "[DATE]");
      }

      const res = await fetch("/api/batch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selectedIds),
          callType,
          assistantType: selectedAssistant,
          messageTemplate: resolvedMessage,
          paymentLink: callType === "payment" ? paymentLink : undefined,
          amount: callType === "payment" ? amount : undefined,
          deadline: callType === "payment" ? deadline : undefined,
          courtDate: callType === "court" ? courtDate : undefined,
          startTime: startTime || undefined,
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
          {/* Contact Multi-Select */}
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

            <div className="bg-gray-800 rounded-lg border border-gray-700">
              {/* Select All header */}
              <label className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700 cursor-pointer hover:bg-gray-750">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600"
                />
                <span className="text-sm font-medium text-gray-300">
                  Select All
                </span>
              </label>

              {/* Scrollable list */}
              <div className="max-h-64 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <p className="px-4 py-3 text-gray-400 text-sm">
                    No contacts found
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleContact(contact.id)}
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-600"
                      />
                      <span className="text-sm text-white">{contact.name}</span>
                      {contact.phone && (
                        <span className="text-sm text-gray-400 ml-auto">
                          {contact.phone}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Selection count */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {selectedCount} of {contacts.length} selected
              </span>
              {isOverMax && (
                <span className="text-sm text-red-400 font-medium">
                  (max {MAX_BATCH})
                </span>
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
                  Amount
                </label>
                <input
                  type="text"
                  placeholder="e.g. $500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
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
