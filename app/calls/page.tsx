"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Sidebar from "@/components/Sidebar";

interface CallEntry {
  type: "call";
  id: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  status: string;
  outcome?: string | null;
  sentiment?: string | null;
  transcript?: string | null;
  summary?: string | null;
  recordingUrl?: string | null;
  duration?: number | null;
  callType?: string;
  date: string;
}

interface TextEntry {
  type: "text";
  id: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  direction?: string;
  message?: string;
  status?: string;
  date: string;
}

type ActivityEntry = CallEntry | TextEntry;

const ITEMS_PER_PAGE = 50;

const FILTER_TABS = ["All", "Calls", "Texts", "Inbound"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "--";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function getMessageOrSummary(entry: ActivityEntry): string | null | undefined {
  if (entry.type === "text") {
    return (entry as TextEntry).message || (entry as TextEntry).body;
  }
  return (entry as CallEntry).summary;
}

function getSentimentColor(sentiment: string | null | undefined): string {
  if (!sentiment) return "bg-gray-700 text-gray-300";
  const s = sentiment.toLowerCase();
  if (s === "positive") return "bg-green-900 text-green-300";
  if (s === "negative") return "bg-red-900 text-red-300";
  return "bg-gray-700 text-gray-300";
}

function getStatusColor(status: string | null | undefined): string {
  if (!status) return "bg-gray-700 text-gray-300";
  const s = status.toLowerCase();
  if (s === "completed" || s === "delivered" || s === "sent")
    return "bg-green-900 text-green-300";
  if (s === "failed" || s === "error") return "bg-red-900 text-red-300";
  if (s === "in-progress" || s === "ringing" || s === "queued")
    return "bg-yellow-900 text-yellow-300";
  return "bg-gray-700 text-gray-300";
}

export default function CallsPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (json.success && json.data?.recentActivity) {
          setEntries(json.data.recentActivity);
        }
      } catch (err) {
        console.error("Failed to fetch activity:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = entries;

    // Filter by tab
    if (activeFilter === "Calls") {
      result = result.filter((e) => e.type === "call");
    } else if (activeFilter === "Texts") {
      result = result.filter((e) => e.type === "text");
    } else if (activeFilter === "Inbound") {
      result = result.filter(
        (e) => e.type === "text" && (e as TextEntry).direction === "inbound"
      );
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        const name = e.contactName?.toLowerCase() || "";
        const phone = e.contactPhone?.toLowerCase() || "";
        const msg = getMessageOrSummary(e)?.toLowerCase() || "";
        return name.includes(q) || phone.includes(q) || msg.includes(q);
      });
    }

    return result;
  }, [entries, activeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, search]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Sidebar />
      <main className="lg:ml-64 p-6 min-h-screen">
        <h1 className="text-2xl font-bold text-white mb-6">
          Calls &amp; Texts Log
        </h1>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, phone, or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === tab
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Info banner */}
        {entries.length > 0 && entries.length <= 20 && (
          <p className="text-sm text-gray-500 mb-4">
            Showing recent {entries.length} entries
          </p>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No entries found.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="px-4 py-3 font-medium">Contact Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Date/Time</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Status/Outcome</th>
                    <th className="px-4 py-3 font-medium">Sentiment</th>
                    <th className="px-4 py-3 font-medium">Message/Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paginated.map((entry) => {
                    const isExpanded = expandedId === entry.id;
                    const isCall = entry.type === "call";
                    const callEntry = entry as CallEntry;
                    const textEntry = entry as TextEntry;

                    return (
                      <Fragment key={entry.id}>
                        <tr
                          onClick={() =>
                            setExpandedId(isExpanded ? null : entry.id)
                          }
                          className="cursor-pointer hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">
                              {entry.contactName || "Unknown"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {entry.contactPhone || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              {isCall ? (
                                <svg
                                  className="w-4 h-4 text-blue-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-4 h-4 text-green-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                                  />
                                </svg>
                              )}
                              <span
                                className={
                                  isCall ? "text-blue-400" : "text-green-400"
                                }
                              >
                                {isCall ? "Call" : "Text"}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {isCall
                              ? formatDuration(callEntry.duration)
                              : "--"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                isCall
                                  ? callEntry.outcome || callEntry.status
                                  : textEntry.status ||
                                      textEntry.direction
                              )}`}
                            >
                              {isCall
                                ? callEntry.outcome || callEntry.status
                                : textEntry.status || textEntry.direction || "--"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isCall ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(
                                  callEntry.sentiment
                                )}`}
                              >
                                {callEntry.sentiment || "N/A"}
                              </span>
                            ) : (
                              <span className="text-gray-600">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 max-w-xs">
                            {truncate(getMessageOrSummary(entry), 80)}
                          </td>
                        </tr>

                        {/* Expanded Row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="px-4 py-4">
                              <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                                {isCall ? (
                                  <>
                                    {callEntry.summary && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                                          Summary
                                        </h4>
                                        <p className="text-gray-200 text-sm">
                                          {callEntry.summary}
                                        </p>
                                      </div>
                                    )}
                                    {callEntry.transcript && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                                          Transcript
                                        </h4>
                                        <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                                          {callEntry.transcript}
                                        </pre>
                                      </div>
                                    )}
                                    {callEntry.recordingUrl && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                                          Recording
                                        </h4>
                                        <audio
                                          controls
                                          src={callEntry.recordingUrl}
                                          className="w-full max-w-md"
                                        />
                                      </div>
                                    )}
                                    {!callEntry.summary &&
                                      !callEntry.transcript &&
                                      !callEntry.recordingUrl && (
                                        <p className="text-gray-500 text-sm">
                                          No additional details available for
                                          this call.
                                        </p>
                                      )}
                                  </>
                                ) : (
                                  <div>
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                                      Full Message
                                    </h4>
                                    <p className="text-gray-200 text-sm whitespace-pre-wrap">
                                      {textEntry.message ||
                                        textEntry.body ||
                                        "No message body."}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
