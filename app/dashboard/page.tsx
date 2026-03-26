'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface StatsData {
  callsThisMonth: number;
  textsThisMonth: number;
  allTimeCalls: number;
  allTimeTexts: number;
  activeBatches: Array<{
    id: string;
    name: string;
    status: 'running' | 'completed' | 'pending';
    completedCalls: number;
    totalCalls: number;
  }>;
  recentActivity: Array<{
    id: string;
    contactName: string;
    type: 'call' | 'text';
    date: string;
    status: string;
    summary: string;
  }>;
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
      <div className="h-9 w-20 bg-gray-700 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-700 rounded" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    pending: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(str: string, len: number) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Fire cron init in background (don't block on it)
        fetch('/api/cron/init').catch(() => {});

        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load stats');
        setStats(json.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Sidebar />

      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ── Top Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : stats ? (
            <>
              <StatCard value={stats.callsThisMonth} label="Calls This Month" />
              <StatCard value={stats.textsThisMonth} label="Texts This Month" />
              <StatCard value={stats.allTimeCalls} label="All-Time Calls" />
              <StatCard value={stats.allTimeTexts} label="All-Time Texts" />
            </>
          ) : null}
        </div>

        {/* ── Active Batch Campaigns ── */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Active Batch Campaigns</h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse">
                  <div className="h-5 w-48 bg-gray-700 rounded mb-3" />
                  <div className="h-3 w-full bg-gray-800 rounded" />
                </div>
              ))}
            </div>
          ) : stats?.activeBatches && stats.activeBatches.length > 0 ? (
            <div className="space-y-4">
              {stats.activeBatches.map((batch) => {
                const pct = batch.totalCalls > 0 ? Math.round((batch.completedCalls / batch.totalCalls) * 100) : 0;
                return (
                  <div key={batch.id} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-white">{batch.name}</span>
                      <StatusBadge status={batch.status} />
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {batch.completedCalls} / {batch.totalCalls} calls ({pct}%)
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active batch campaigns.</p>
          )}
        </section>

        {/* ── Recent Activity ── */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>

          {loading ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 animate-pulse p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 mb-4 last:mb-0">
                  <div className="h-4 w-28 bg-gray-700 rounded" />
                  <div className="h-4 w-16 bg-gray-700 rounded" />
                  <div className="h-4 w-32 bg-gray-700 rounded" />
                  <div className="h-4 w-16 bg-gray-700 rounded" />
                  <div className="h-4 flex-1 bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Summary / Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {stats.recentActivity.slice(0, 20).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-white whitespace-nowrap">{item.contactName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.type === 'call' ? (
                          <span className="inline-flex items-center gap-1 text-blue-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Call
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            Text
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-300">{truncate(item.summary, 60)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent activity.</p>
          )}
        </section>

        {/* ── Quick Links ── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/caller"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Caller
            </Link>
            <Link
              href="/batch"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Batch Campaigns
            </Link>
            <Link
              href="/contacts"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Contacts
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
