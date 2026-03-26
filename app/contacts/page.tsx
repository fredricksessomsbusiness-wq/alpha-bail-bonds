'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface Contact {
  id: string;
  name: string;
  phone: string;
  defendantName?: string;
  status: 'active' | 'paused' | 'do_not_contact';
  lastOutcome?: string;
  lastContactedAt?: string;
}

const emptyForm = { name: '', phone: '', defendantName: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      setError(null);
      const res = await fetch('/api/contacts');
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const json = await res.json();
      setContacts(json.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleSave = async () => {
    try {
      setError(null);
      if (editingId) {
        const res = await fetch(`/api/contacts/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to update contact');
      } else {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to create contact');
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await fetchContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    }
  };

  const handleEdit = (contact: Contact) => {
    setForm({
      name: contact.name,
      phone: contact.phone,
      defendantName: contact.defendantName ?? '',
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete contact');
      setDeleteConfirmId(null);
      await fetchContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const filtered = contacts.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term)
    );
  });

  const statusBadge = (status: Contact['status']) => {
    const map: Record<Contact['status'], { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Active' },
      paused: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Paused' },
      do_not_contact: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Do Not Contact' },
    };
    const s = map[status] ?? map.active;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const formatDate = (dateStr?: string) => {
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
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Sidebar />
      <main className="lg:ml-64 p-6 pt-16 lg:pt-6 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Contacts</h1>
            <button
              onClick={() => {
                if (showForm) {
                  handleCancel();
                } else {
                  setShowForm(true);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showForm ? 'Close Form' : 'Add Contact'}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Add / Edit Form */}
          {showForm && (
            <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {editingId ? 'Edit Contact' : 'Add Contact'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Contact name"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 (919) 000-0000"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">US numbers: enter 10 digits — +1 added automatically</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Defendant Name</label>
                  <input
                    type="text"
                    value={form.defendantName}
                    onChange={(e) => setForm({ ...form, defendantName: e.target.value })}
                    placeholder="Defendant name"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {editingId ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          {/* Loading state */}
          {loading && (
            <div className="text-center py-12 text-gray-400">Loading contacts...</div>
          )}

          {/* Contacts Table */}
          {!loading && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Defendant</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Last Outcome</th>
                      <th className="px-6 py-3">Last Contacted</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          {search ? 'No contacts match your search.' : 'No contacts found.'}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((contact) => (
                        <tr key={contact.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <Link
                              href={`/clients/${contact.id}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                            >
                              {contact.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-gray-300">{contact.phone}</td>
                          <td className="px-6 py-4 text-gray-300">
                            {contact.defendantName || '-'}
                          </td>
                          <td className="px-6 py-4">{statusBadge(contact.status)}</td>
                          <td className="px-6 py-4 text-gray-300">
                            {contact.lastOutcome || '-'}
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {formatDate(contact.lastContactedAt)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(contact)}
                                className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded text-xs font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(contact.id)}
                                className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded text-xs font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Contact</h3>
              <p className="text-gray-400 text-sm mb-6">
                Are you sure you want to delete this contact? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
