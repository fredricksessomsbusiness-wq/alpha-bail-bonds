"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";

interface Contact {
  id: string;
  name: string;
  phone?: string;
  nextPaymentAmount?: string | null;
  courtDate?: string | null;
  defendantName?: string;
}

type CallType = "payment" | "court";

export default function SingleCallPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [callType, setCallType] = useState<CallType>("payment");

  // Payment fields
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  // Court fields
  const [courtDate, setCourtDate] = useState("");

  const [calling, setCalling] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; callId?: string } | null>(null);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((json) => setContacts(json.data ?? []))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Re-apply prefill when callType changes
  useEffect(() => {
    if (!selectedContact) return;
    applyPrefill(selectedContact, callType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callType]);

  function applyPrefill(contact: Contact, type: CallType) {
    if (type === "payment") {
      setAmount(contact.nextPaymentAmount || "");
      setDeadline("");
      setPaymentLink("");
    } else {
      setCourtDate(
        contact.courtDate
          ? new Date(contact.courtDate).toISOString().split("T")[0]
          : ""
      );
    }
  }

  function selectContact(contact: Contact) {
    setContactId(contact.id);
    setSelectedContact(contact);
    setContactSearch("");
    setDropdownOpen(false);
    setResult(null);
    applyPrefill(contact, callType);
  }

  function clearContact() {
    setContactId("");
    setSelectedContact(null);
    setAmount("");
    setDeadline("");
    setPaymentLink("");
    setCourtDate("");
    setResult(null);
  }

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  async function handleCall(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) return;

    setCalling(true);
    setResult(null);

    try {
      const res = await fetch("/api/call/now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          callType,
          amount: callType === "payment" ? amount : undefined,
          deadline: callType === "payment" ? deadline : undefined,
          paymentLink: callType === "payment" ? paymentLink : undefined,
          courtDate: callType === "court" ? courtDate : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: `✅ Call connected to ${selectedContact?.name}. Vapi call ID: ${data.data.callId}`,
          callId: data.data.callId,
        });
      } else {
        setResult({ success: false, message: `❌ ${data.error || "Call failed"}` });
      }
    } catch {
      setResult({ success: false, message: "❌ Network error. Please try again." });
    } finally {
      setCalling(false);
    }
  }

  const hasPrefill =
    selectedContact &&
    ((callType === "payment" && selectedContact.nextPaymentAmount) ||
      (callType === "court" && selectedContact.courtDate));

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-white mb-1">Single Call</h1>
          <p className="text-gray-400 text-sm mb-8">Place an immediate AI call to one contact via Vapi.</p>

          <form onSubmit={handleCall} className="space-y-6">

            {/* Contact selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Contact</label>
              <div ref={dropdownRef} className="relative">
                {selectedContact && !dropdownOpen ? (
                  <div className="flex items-center justify-between w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5">
                    <div>
                      <span className="font-medium">{selectedContact.name}</span>
                      {selectedContact.phone && (
                        <span className="text-gray-400 text-sm ml-2">{selectedContact.phone}</span>
                      )}
                    </div>
                    <button type="button" onClick={clearContact} className="text-gray-400 hover:text-white text-xs ml-3">
                      Change
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => { setContactSearch(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                )}
                {dropdownOpen && (
                  <ul className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg max-h-56 overflow-y-auto shadow-xl">
                    {filteredContacts.length === 0 ? (
                      <li className="px-4 py-3 text-gray-400 text-sm">No contacts found</li>
                    ) : (
                      filteredContacts.map((c) => (
                        <li
                          key={c.id}
                          onClick={() => selectContact(c)}
                          className="px-4 py-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0"
                        >
                          <span className="text-white text-sm font-medium">{c.name}</span>
                          {c.phone && <span className="text-gray-400 text-xs ml-2">{c.phone}</span>}
                          <div className="flex gap-3 mt-0.5">
                            {c.nextPaymentAmount && (
                              <span className="text-green-400 text-xs">💳 {c.nextPaymentAmount}</span>
                            )}
                            {c.courtDate && (
                              <span className="text-blue-400 text-xs">
                                ⚖️ {new Date(c.courtDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Call type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Call Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCallType("payment")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                    callType === "payment"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  💳 Payment Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setCallType("court")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                    callType === "court"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  ⚖️ Court Date Reminder
                </button>
              </div>
            </div>

            {/* Pre-fill notice */}
            {hasPrefill && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-800 rounded-lg text-blue-300 text-xs">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pre-filled from contact record — edit to override
              </div>
            )}

            {/* Payment fields */}
            {callType === "payment" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount Owed
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. $500.00"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Deadline <span className="text-gray-500 font-normal">(optional)</span>
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
                    Payment Link <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Court fields */}
            {callType === "court" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Court Date</label>
                <input
                  type="date"
                  value={courtDate}
                  onChange={(e) => setCourtDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`p-4 rounded-lg text-sm font-medium ${result.success ? "bg-green-900/30 border border-green-700 text-green-300" : "bg-red-900/30 border border-red-700 text-red-300"}`}>
                {result.message}
              </div>
            )}

            {/* Call button */}
            <button
              type="submit"
              disabled={!contactId || calling}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
            >
              {calling ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Now
                </>
              )}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
}
