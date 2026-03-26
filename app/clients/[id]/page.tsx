'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface Contact {
  id: string;
  name: string;
  phone: string;
  defendantName: string;
  status: string;
  lastOutcome: string | null;
  lastSentiment: string | null;
  lastContactedAt: string | null;
  courtDate: string | null;
  nextPaymentAmount: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Call {
  id: string;
  contactId: string;
  callType: string;
  status: string;
  outcome: string | null;
  sentiment: string | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  duration: number | null;
  createdAt: string;
}

interface TextMessage {
  id: string;
  contactId: string;
  direction: string;
  body: string;
  sentAt: string;
  status: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    do_not_contact: 'bg-red-500/20 text-red-400',
  };
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${colors[status] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-gray-500 text-xs">--</span>;
  const colors: Record<string, string> = {
    answered: 'bg-green-500/20 text-green-400',
    no_answer: 'bg-yellow-500/20 text-yellow-400',
    voicemail: 'bg-blue-500/20 text-blue-400',
    busy: 'bg-orange-500/20 text-orange-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colors[outcome] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {outcome.replace(/_/g, ' ')}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const colors: Record<string, string> = {
    positive: 'bg-green-500/20 text-green-400',
    negative: 'bg-red-500/20 text-red-400',
    neutral: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colors[sentiment] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {sentiment}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const colors: Record<string, string> = {
    outbound: 'bg-blue-500/20 text-blue-400',
    inbound: 'bg-green-500/20 text-green-400',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colors[direction] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {direction}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Never';
  }
}

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [textMessages, setTextMessages] = useState<TextMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDefendant, setEditDefendant] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editCourtDate, setEditCourtDate] = useState('');
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick-send text state
  const [showTextForm, setShowTextForm] = useState(false);
  const [textMessage, setTextMessage] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [textFeedback, setTextFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expanded call transcripts
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Failed to fetch contact');

      const { contact: fetchedContact, calls: fetchedCalls, textMessages: fetchedTexts } = json.data;

      setContact(fetchedContact);
      setEditName(fetchedContact.name);
      setEditPhone(fetchedContact.phone);
      setEditDefendant(fetchedContact.defendantName);
      setEditStatus(fetchedContact.status);
      setEditCourtDate(
        fetchedContact.courtDate
          ? new Date(fetchedContact.courtDate).toISOString().split('T')[0]
          : ''
      );
      setEditPaymentAmount(fetchedContact.nextPaymentAmount ?? '');
      setCalls(fetchedCalls);
      setTextMessages(fetchedTexts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveEdit() {
    if (!contact) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          defendantName: editDefendant,
          status: editStatus,
          courtDate: editCourtDate || null,
          nextPaymentAmount: editPaymentAmount || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContact(data.data);
        setEditing(false);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleSendText() {
    if (!textMessage.trim()) return;
    setSendingText(true);
    setTextFeedback(null);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: id, message: textMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setTextFeedback({ type: 'success', message: 'Text sent successfully!' });
        setTextMessage('');
        const newMsg: TextMessage = {
          id: data.data.id,
          contactId: id,
          direction: 'outbound',
          body: data.data.body ?? data.data.message ?? textMessage,
          sentAt: data.data.sentAt ?? new Date().toISOString(),
          status: 'sent',
        };
        setTextMessages((prev) => [newMsg, ...prev]);
      } else {
        setTextFeedback({ type: 'error', message: data.error || 'Failed to send text' });
      }
    } catch {
      setTextFeedback({ type: 'error', message: 'Network error sending text' });
    } finally {
      setSendingText(false);
    }
  }

  function toggleExpanded(callId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }

  const totalCalls = calls.length;
  const totalTexts = textMessages.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        {/* Loading state */}
        {loading && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-8 w-48 bg-gray-700 rounded mb-3" />
              <div className="h-4 w-32 bg-gray-700 rounded mb-2" />
              <div className="h-4 w-40 bg-gray-700 rounded" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse">
                  <div className="h-6 w-12 bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-20 bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => router.push('/contacts')}
              className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition"
            >
              Back to Contacts
            </button>
          </div>
        )}

        {/* Main content */}
        {contact && !loading && (
          <div className="space-y-6">
            {/* Back link */}
            <Link
              href="/contacts"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Contacts
            </Link>

            {/* 1. Header section */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              {!editing ? (
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-bold">{contact.name}</h1>
                      <StatusBadge status={contact.status} />
                    </div>
                    <p className="text-gray-400 text-sm">{contact.phone}</p>
                    {contact.defendantName && (
                      <p className="text-gray-500 text-sm mt-1">
                        Defendant: <span className="text-gray-300">{contact.defendantName}</span>
                      </p>
                    )}
                    {contact.nextPaymentAmount && (
                      <p className="text-gray-500 text-sm mt-1">
                        Next Payment: <span className="text-green-300 font-medium">{contact.nextPaymentAmount}</span>
                      </p>
                    )}
                    {contact.courtDate && (
                      <p className="text-gray-500 text-sm mt-1">
                        Court Date: <span className="text-yellow-300 font-medium">{formatDateOnly(contact.courtDate)}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition self-start"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold mb-2">Edit Contact</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Phone</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Defendant Name</label>
                      <input
                        type="text"
                        value={editDefendant}
                        onChange={(e) => setEditDefendant(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="do_not_contact">Do Not Contact</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Next Payment Amount</label>
                      <input
                        type="text"
                        value={editPaymentAmount}
                        onChange={(e) => setEditPaymentAmount(e.target.value)}
                        placeholder="$500.00"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Court Date</label>
                      <input
                        type="date"
                        value={editCourtDate}
                        onChange={(e) => setEditCourtDate(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditName(contact.name);
                        setEditPhone(contact.phone);
                        setEditDefendant(contact.defendantName);
                        setEditStatus(contact.status);
                        setEditCourtDate(
                          contact.courtDate
                            ? new Date(contact.courtDate).toISOString().split('T')[0]
                            : ''
                        );
                        setEditPaymentAmount(contact.nextPaymentAmount ?? '');
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-2xl font-bold">{totalCalls}</p>
                <p className="text-xs text-gray-400 mt-1">Total Calls</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-2xl font-bold">{totalTexts}</p>
                <p className="text-xs text-gray-400 mt-1">Total Texts</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-sm font-medium">{formatDate(contact.lastContactedAt)}</p>
                <p className="text-xs text-gray-400 mt-1">Last Contacted</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="mb-1">
                  <OutcomeBadge outcome={contact.lastOutcome} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Last Outcome</p>
              </div>
            </div>

            {/* 3. Action buttons row */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/caller?contactId=${id}`}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition inline-flex items-center gap-2"
              >
                <PhoneIcon />
                Call Now
              </Link>
              <button
                onClick={() => {
                  setShowTextForm(!showTextForm);
                  setTextFeedback(null);
                }}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition inline-flex items-center gap-2"
              >
                <ChatIcon />
                Send Text
              </button>
            </div>

            {/* 4. Quick-send text form */}
            {showTextForm && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
                <label className="block text-sm text-gray-300 font-medium">Quick Send Text</label>
                <textarea
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                {textFeedback && (
                  <p
                    className={`text-sm ${textFeedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {textFeedback.message}
                  </p>
                )}
                <button
                  onClick={handleSendText}
                  disabled={sendingText || !textMessage.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {sendingText ? 'Sending...' : 'Send'}
                </button>
              </div>
            )}

            {/* 5. Messages and Calls panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Messages panel */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ChatIcon />
                  Messages
                  <span className="text-sm font-normal text-gray-400">({totalTexts})</span>
                </h2>
                {textMessages.length === 0 ? (
                  <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-500 text-sm">
                    No messages yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {textMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-gray-900 rounded-xl p-4 border border-gray-800"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs text-gray-400">{formatDate(msg.sentAt)}</span>
                          <DirectionBadge direction={msg.direction} />
                        </div>
                        <p className="text-sm text-gray-300">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calls panel */}
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <PhoneIcon />
                  Calls
                  <span className="text-sm font-normal text-gray-400">({totalCalls})</span>
                </h2>
                {calls.length === 0 ? (
                  <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-500 text-sm">
                    No calls yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {calls.map((call) => (
                      <div
                        key={call.id}
                        className="bg-gray-900 rounded-xl p-4 border border-gray-800"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">{formatDate(call.createdAt)}</span>
                          <OutcomeBadge outcome={call.outcome} />
                          <SentimentBadge sentiment={call.sentiment} />
                        </div>
                        {call.summary && (
                          <p className="text-sm text-gray-300 mt-1">{call.summary}</p>
                        )}
                        {call.duration != null && (
                          <p className="text-xs text-gray-500 mt-1">
                            Duration: {Math.floor(call.duration / 60)}m {call.duration % 60}s
                          </p>
                        )}
                        {(call.transcript || call.recordingUrl) && (
                          <button
                            onClick={() => toggleExpanded(call.id)}
                            className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition"
                          >
                            {expandedIds.has(call.id) ? 'Hide Details' : 'Show Details'}
                          </button>
                        )}
                        {expandedIds.has(call.id) && (
                          <div className="mt-3 space-y-3">
                            {call.transcript && (
                              <div className="bg-gray-800 rounded p-4 whitespace-pre-wrap text-sm text-gray-300">
                                {call.transcript}
                              </div>
                            )}
                            {call.recordingUrl && (
                              <audio controls className="w-full">
                                <source src={call.recordingUrl} />
                                Your browser does not support the audio element.
                              </audio>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
