'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cmdbAPI, organizationAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Links an asset to the compliance controls it evidences.
 *
 * asset_control_mappings has been in the schema since migration 005, commented
 * "Links assets to compliance controls for traceability", and had no API and no
 * UI until now — so CM-8 (System Component Inventory), the control an asset
 * inventory exists to satisfy, could not actually be evidenced from the
 * inventory. This is the screen for it.
 *
 * Self-contained on purpose: assets/page.tsx is already very large, so this
 * loads and owns its own state and the page only has to render it.
 */

const COMPLIANCE_STATUS = [
  { value: '', label: 'Not assessed' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'partial', label: 'Partial' },
  { value: 'non_compliant', label: 'Non-compliant' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const STATUS_STYLES: Record<string, string> = {
  compliant: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  non_compliant: 'bg-red-100 text-red-700',
  not_applicable: 'bg-gray-100 text-gray-600',
};

interface MappedControl {
  id: string;
  control_id: string;
  control_ref: string;
  control_title: string;
  framework_code: string;
  framework_name: string;
  compliance_status: string | null;
  notes: string | null;
}

interface PickerControl {
  id: string;
  control_id: string;
  title: string;
  framework_code: string;
}

interface AssetControlLinksProps {
  assetId: string;
}

export default function AssetControlLinks({ assetId }: AssetControlLinksProps) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [mapped, setMapped] = useState<MappedControl[]>([]);
  const [catalog, setCatalog] = useState<PickerControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMapped = useCallback(async () => {
    try {
      setLoading(true);
      const res = await cmdbAPI.assetControls.list(assetId);
      const data = res.data?.data ?? [];
      setMapped(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('Could not load linked controls.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { loadMapped(); }, [loadMapped]);

  // The catalog is only needed once the operator opens the picker.
  useEffect(() => {
    if (!adding || !orgId || catalog.length > 0) return;
    (async () => {
      try {
        const res = await organizationAPI.getControls(orgId, { limit: 500 });
        const data = res.data?.data ?? [];
        setCatalog(Array.isArray(data) ? data : []);
      } catch {
        setError('Could not load the control catalog.');
      }
    })();
  }, [adding, orgId, catalog.length]);

  const linkedIds = useMemo(() => new Set(mapped.map((row) => row.control_id)), [mapped]);

  const options = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog
      .filter((control) => !linkedIds.has(control.id))
      .filter((control) => !term
        || control.control_id.toLowerCase().includes(term)
        || control.title.toLowerCase().includes(term))
      .slice(0, 100);
  }, [catalog, linkedIds, search]);

  const link = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      await cmdbAPI.assetControls.link(assetId, {
        control_id: choice,
        ...(status ? { compliance_status: status } : {}),
      });
      setChoice(''); setStatus(''); setSearch(''); setAdding(false);
      await loadMapped();
    } catch {
      setError('Could not link that control.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (controlId: string) => {
    setBusy(true);
    try {
      await cmdbAPI.assetControls.unlink(assetId, controlId);
      await loadMapped();
    } catch {
      setError('Could not unlink that control.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (controlId: string, next: string) => {
    setBusy(true);
    try {
      await cmdbAPI.assetControls.update(assetId, controlId, { compliance_status: next || null });
      await loadMapped();
    } catch {
      setError('Could not update that mapping.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Compliance Controls</h3>
        <button
          onClick={() => setAdding((open) => !open)}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          {adding ? 'Cancel' : '+ Link control'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {adding && (
        <div className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search controls (e.g. CM-8)"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">Select a control…</option>
            {options.map((control) => (
              <option key={control.id} value={control.id}>
                {control.framework_code} · {control.control_id} — {control.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {COMPLIANCE_STATUS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
            <button
              onClick={link}
              disabled={!choice || busy}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
            >
              Link
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : mapped.length === 0 ? (
        <p className="text-xs text-gray-500">
          No controls linked yet. Linking this asset to a control — CM-8 for inventory,
          AC-2 for accounts — is what lets it count as evidence.
        </p>
      ) : (
        <ul role="list" className="space-y-2">
          {mapped.map((row) => (
            <li key={row.id} role="listitem" className="border border-gray-200 rounded-lg p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    <span className="text-gray-500">{row.framework_code}</span> · {row.control_ref}
                  </p>
                  <p className="text-xs text-gray-600 truncate">{row.control_title}</p>
                </div>
                <button
                  onClick={() => unlink(row.control_id)}
                  disabled={busy}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                  Unlink
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    STATUS_STYLES[row.compliance_status || ''] || 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {COMPLIANCE_STATUS.find((entry) => entry.value === (row.compliance_status || ''))?.label
                    ?? 'Not assessed'}
                </span>
                <select
                  aria-label={`Compliance status for ${row.control_ref}`}
                  value={row.compliance_status || ''}
                  onChange={(e) => changeStatus(row.control_id, e.target.value)}
                  disabled={busy}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5"
                >
                  {COMPLIANCE_STATUS.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
