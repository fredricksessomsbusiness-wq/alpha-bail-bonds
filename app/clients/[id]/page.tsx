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
  createdAt: string;
  updatedAt: string;
}

interface CallEntry {
  type: 'call';
  id: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  status: string;
  outcome: string | null;
  sentiment: string | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  duration: number | null;
  date: string;
}

interface TextEntry {
  type: 'text';
  id: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  direction: string;
  message: string;
  date: string;
}

type TimelineEntry = CallEntry | TextEntry;

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

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDefendant, setEditDefendant] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick-send text state
  const [showTextForm, setShowTextForm] = useState(false);
  const [textMessage, setTextMessage] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [textFeedback, setTextFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expanded transcripts
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [contactsRes, statsRes] = await Promise.all([
          fetch('/api/contacts'),
          fetch('/api/stats'),
        ]);

        const contactsData = await contactsRes.json();
        const statsData = await statsRes.json();

        if (!contactsData.success) throw new Error('Failed to fetch contacts');

        const foundContact = contactsData.data.find((c: Contact) => c.id === id);
        if (!foundContact) {
          setError('Contact not found');
          setLoading(false);
          return;
        }

        setContact(foundContact);
        setEditName(foundContact.name);
        setEditPhone(foundContact.phone);
        setEditDefendant(foundContact.defendantName);
        setEditStatus(foundContact.status);

        // Build timeline from stats recentActivity filtered by contactId
        if (statsData.success && statsData.data?.recentActivity) {
          const filtered = statsData.data.recentActivity.filter(
            (entry: { contactId?: string; contactName?: string; contactPhone?: string }) =>
              entry.contactId === id ||
              (entry.contactName === foundContact.name && entry.contactPhone === foundContact.phone)
          );
          setTimeline(filtered as TimelineEntry[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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
        // Add to timeline
        setTimeline((prev) => [
          {
            type: 'text',
            id: data.data.id,
            contactId: id,
            contactName: contact?.name ?? '',
            contactPhone: contact?.phone ?? '',
            direction: 'outbound',
            message: data.data.body ?? data.data.message ?? textMessage,
            createdAt: data.data.sentAt ?? new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setTextFeedback({ type: 'error', message: data.error || 'Failed to send text' });
      }
    } catch {
      setTextFeedback({ type: 'error', message: 'Network error sending text' });
    } finally {
      setSendingText(false);
    }
  }

  function toggleExpanded(entryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  // Compute stats from contact + timeline
  const totalCalls = timeline.filter((e) => e.type === 'call').length;
  const totalTexts = timeline.filter((e) => e.type === 'text').length;

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar />
      <main className="lg:ml-64 p-6 min-h-screen">
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

            {/* 5. Timeline section */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
              {timeline.length === 0 ? (
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-500">
                  No activity recorded for this contact yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-gray-900 rounded-xl p-4 border border-gray-800"
                    >
                      {entry.type === 'call' ? (
                        // Call entry
                        <div>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <PhoneIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-sm text-gray-400">
                                  {formatDate(entry.date)}
                                </span>
                                <OutcomeBadge outcome={entry.outcome} />
                                <SentimentBadge sentiment={entry.sentiment} />
                              </div>
                              {entry.summary && (
                                <p className="text-sm text-gray-300 mt-1">{entry.summary}</p>
                              )}
                              {entry.duration != null && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Duration: {Math.floor(entry.duration / 60)}m {entry.duration % 60}s
                                </p>
                              )}
                              {(entry.transcript || entry.recordingUrl) && (
                                <button
                                  onClick={() => toggleExpanded(entry.id)}
                                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition"
                                >
                                  {expandedIds.has(entry.id) ? 'Hide Details' : 'Show Details'}
                                </button>
                              )}
                              {expandedIds.has(entry.id) && (
                                <div className="mt-3 space-y-3">
                                  {entry.transcript && (
                                    <div className="bg-gray-800 rounded p-4 whitespace-pre-wrap text-sm text-gray-300">
                                      {entry.transcript}
                                    </div>
                                  )}
                                  {entry.recordingUrl && (
                                    <audio controls className="w-full">
                                      <source src={entry.recordingUrl} />
                                      Your browser does not support the audio element.
                                    </audio>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Text entry
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <ChatIcon />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm text-gray-400">
                                {formatDate(entry.date)}
                              </span>
                              <DirectionBadge direction={entry.direction} />
                            </div>
                            <p className="text-sm text-gray-300 mt-1">{entry.message}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
