// @tier: pro
'use client';

import { useCallback, useEffect, useState } from 'react';
import { contactsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/access';

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  title: string | null;
  team: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface ContactFormState {
  full_name: string;
  email: string;
  title: string;
  team: string;
  notes: string;
}

const EMPTY_FORM: ContactFormState = {
  full_name: '',
  email: '',
  title: '',
  team: '',
  notes: '',
};

export default function OrganizationContactsTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'users.manage');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadContacts = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      setLoading(true);
      setError('');
      const response = await contactsAPI.getList();
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      if (!cancelledRef?.current) setContacts(data);
    } catch {
      if (!cancelledRef?.current) setError('Failed to load organization contacts.');
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadContacts(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadContacts]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (contact: Contact) => {
    setEditingId(contact.id);
    setForm({
      full_name: contact.full_name,
      email: contact.email || '',
      title: contact.title || '',
      team: contact.team || '',
      notes: contact.notes || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const submitForm = async () => {
    if (!form.full_name.trim()) {
      setFormError('Full name is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await contactsAPI.update(editingId, {
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          title: form.title.trim() || null,
          team: form.team.trim() || null,
          notes: form.notes.trim() || null,
        });
      } else {
        await contactsAPI.create({
          full_name: form.full_name.trim(),
          email: form.email.trim() || undefined,
          title: form.title.trim() || undefined,
          team: form.team.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
      }
      closeForm();
      await loadContacts();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateContact = async (id: string) => {
    if (!window.confirm('Deactivate this contact?')) return;
    setBusyId(id);
    try {
      await contactsAPI.remove(id);
      await loadContacts();
    } catch {
      setError('Failed to deactivate contact.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Organization Contacts</h2>
          <p className="text-sm text-gray-600 mt-1">Key contacts for compliance, security, and audit coordination.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateForm}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Contact
          </button>
        )}
      </div>

      {!canManage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          You can view contacts, but only users with <code>users.manage</code> can add, edit, or deactivate them.
        </div>
      )}

      {showForm && canManage && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">{editingId ? 'Edit Contact' : 'Add Contact'}</h3>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Full Name</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Team</span>
              <input
                type="text"
                value={form.team}
                onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gray-500">No contacts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200" role="list">
            <thead className="bg-gray-50">
              <tr role="listitem">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                {canManage && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.id} role="listitem" className={contact.is_active ? '' : 'opacity-60'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{contact.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.title || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.team || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${contact.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                      aria-label={`Contact status: ${contact.is_active ? 'active' : 'inactive'}`}
                    >
                      {contact.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(contact)}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        {contact.is_active && (
                          <button
                            type="button"
                            onClick={() => deactivateContact(contact.id)}
                            disabled={busyId === contact.id}
                            className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
