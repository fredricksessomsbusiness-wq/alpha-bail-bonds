"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";

interface Contact {
  id: string;
  name: string;
  phone?: string;
}

interface ContactDetail {
  id: string;
  nextPaymentAmount: string | null;
  courtDate: string | null;
}

type CallType = "payment" | "court";

const PAYMENT_TEMPLATE =
  "This is Alpha Bail Bonds. You have an outstanding balance of [AMOUNT] due by [DEADLINE]. Please call us or pay online: [LINK]";
const COURT_TEMPLATE =
  "This is Alpha Bail Bonds. You have a court appearance on [DATE]. You MUST appear or a warrant will be issued. Call us with any questions.";

export default function CallerPage() {
  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactId, setContactId] = useState("");
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedContactData, setSelectedContactData] = useState<ContactDetail | null>(null);
  const [preFilled, setPreFilled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Call type
  const [callType, setCallType] = useState<CallType>("payment");

  // Message
  const [messageTemplate, setMessageTemplate] = useState(PAYMENT_TEMPLATE);

  // Payment fields
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  // Court fields
  const [courtDate, setCourtDate] = useState("");

  // Scheduling
  const [scheduleCall, setScheduleCall] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // Submission state
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

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

  // Update message template when call type changes
  useEffect(() => {
    setMessageTemplate(callType === "payment" ? PAYMENT_TEMPLATE : COURT_TEMPLATE);
    if (selectedContactData) {
      applyContactPrefill(selectedContactData, callType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callType]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dismiss toast after 5s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  async function selectContact(contact: Contact) {
    setContactId(contact.id);
    setSelectedContactName(contact.name);
    setContactSearch("");
    setDropdownOpen(false);
    setPreFilled(false);

    try {
      const res = await fetch(`/api/contacts/${contact.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const detail: ContactDetail = json.data.contact;
          setSelectedContactData(detail);
          applyContactPrefill(detail, callType);
        }
      }
    } catch {
      // silently fail
    }
  }

  function applyContactPrefill(detail: ContactDetail, type: string) {
    let didPrefill = false;
    if (type === 'payment' && detail.nextPaymentAmount) {
      setAmount(detail.nextPaymentAmount);
      didPrefill = true;
    }
    if (type === 'court' && detail.courtDate) {
      setCourtDate(new Date(detail.courtDate).toISOString().split('T')[0]);
      didPrefill = true;
    }
    setPreFilled(didPrefill);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) {
      setToast({ type: "error", message: "Please select a contact." });
      return;
    }

    // Replace placeholders with actual values before sending
    let resolvedMessage = messageTemplate;
    if (callType === "payment") {
      resolvedMessage = resolvedMessage
        .replace(/\[AMOUNT\]/g, amount || "[AMOUNT]")
        .replace(/\[DEADLINE\]/g, deadline || "[DEADLINE]")
        .replace(/\[LINK\]/g, paymentLink || "[LINK]");
    } else {
      resolvedMessage = resolvedMessage
        .replace(/\[DATE\]/g, courtDate || "[DATE]");
    }

    setSending(true);
    setToast(null);
    setResult(null);

    try {
      const res = await fetch("/api/calls/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          callType,
          messageTemplate: resolvedMessage,
          paymentLink: callType === "payment" ? paymentLink : undefined,
          amount: callType === "payment" ? amount : undefined,
          deadline: callType === "payment" ? deadline : undefined,
          courtDate: callType === "court" ? courtDate : undefined,
          scheduleCall,
          scheduledAt: scheduleCall ? scheduledAt : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setToast({ type: "success", message: "Call sent successfully!" });
        setResult(data);
      } else {
        setToast({
          type: "error",
          message: data.error || "Failed to send call.",
        });
      }
    } catch {
      setToast({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-8">Push Button Caller</h1>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-6 p-4 rounded-lg text-white font-medium ${
              toast.type === "success"
                ? "bg-green-600"
                : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {/* Contact Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contact
            </label>
            <div ref={dropdownRef} className="relative">
              {selectedContactName && !dropdownOpen ? (
                <div
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 cursor-pointer flex items-center justify-between"
                  onClick={() => {
                    setDropdownOpen(true);
                    setSelectedContactName("");
                    setContactId("");
                  }}
                >
                  <span>{selectedContactName}</span>
                  <span className="text-gray-400 text-xs">Change</span>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              )}

              {dropdownOpen && (
                <ul className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <li className="px-4 py-3 text-gray-400 text-sm">
                      No contacts found
                    </li>
                  ) : (
                    filteredContacts.map((contact) => (
                      <li
                        key={contact.id}
                        className="px-4 py-3 text-white hover:bg-gray-700 cursor-pointer text-sm"
                        onClick={() => selectContact(contact)}
                      >
                        {contact.name}
                        {contact.phone && (
                          <span className="text-gray-400 ml-2">
                            {contact.phone}
                          </span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Pre-fill note */}
          {preFilled && (
            <p className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800 rounded-lg px-3 py-2">
              Pre-filled from contact record — edit to override
            </p>
          )}

          {/* Call Type Radio Buttons */}
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

          {/* Message Template */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message Template
            </label>
            <textarea
              rows={4}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          {/* Live message preview */}
          {(() => {
            let preview = messageTemplate;
            if (callType === "payment") {
              preview = preview
                .replace(/\[AMOUNT\]/g, amount || "[AMOUNT]")
                .replace(/\[DEADLINE\]/g, deadline || "[DEADLINE]")
                .replace(/\[LINK\]/g, paymentLink || "[LINK]");
            } else {
              preview = preview.replace(/\[DATE\]/g, courtDate || "[DATE]");
            }
            const hasPlaceholders = /\[AMOUNT\]|\[DEADLINE\]|\[LINK\]|\[DATE\]/.test(preview);
            return (
              <div className={`p-3 rounded-lg border text-sm ${hasPlaceholders ? "bg-yellow-900/20 border-yellow-700 text-yellow-300" : "bg-gray-800/50 border-gray-700 text-gray-300"}`}>
                <p className="text-xs font-medium mb-1 text-gray-400">SMS Preview:</p>
                <p>{preview}</p>
                {hasPlaceholders && <p className="text-xs mt-1 text-yellow-400">⚠ Fill in the fields below to complete the message</p>}
              </div>
            );
          })()}

          {/* Conditional Inputs */}
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

          {/* Schedule AI Call */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleCall}
                onChange={(e) => {
                  setScheduleCall(e.target.checked);
                  if (e.target.checked && !scheduledAt) {
                    const d = new Date(Date.now() + 5 * 60 * 1000);
                    setScheduledAt(d.toISOString().slice(0, 16));
                  }
                }}
                className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-600"
              />
              <span className="text-sm font-medium text-gray-300">
                Schedule AI Call
              </span>
            </label>

            {scheduleCall && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Scheduled At <span className="text-gray-500 font-normal">(min 3 min from now, 10:30 AM–8:00 PM ET)</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={(() => {
                    const d = new Date(Date.now() + 4 * 60 * 1000);
                    return d.toISOString().slice(0, 16);
                  })()}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={sending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>

        {/* Result Section */}
        {result && (
          <div className="max-w-2xl mt-8 p-5 bg-gray-800 border border-gray-700 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-3">Result</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-400">Contact:</dt>
                <dd className="text-white">{selectedContactName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400">Type:</dt>
                <dd className="text-white capitalize">{callType} reminder</dd>
              </div>
              {scheduleCall && scheduledAt && (
                <div className="flex gap-2">
                  <dt className="text-gray-400">Scheduled:</dt>
                  <dd className="text-white">
                    {new Date(scheduledAt).toLocaleString()}
                  </dd>
                </div>
              )}
              {!scheduleCall && (
                <div className="flex gap-2">
                  <dt className="text-gray-400">Status:</dt>
                  <dd className="text-green-400">SMS sent immediately</dd>
                </div>
              )}
              {callType === "payment" && amount && (
                <div className="flex gap-2">
                  <dt className="text-gray-400">Amount:</dt>
                  <dd className="text-white">{amount}</dd>
                </div>
              )}
              {callType === "court" && courtDate && (
                <div className="flex gap-2">
                  <dt className="text-gray-400">Court Date:</dt>
                  <dd className="text-white">{courtDate}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
