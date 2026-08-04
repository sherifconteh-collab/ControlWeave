'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { tprmAPI } from '@/lib/api';

/**
 * The register risks arising from a vendor.
 *
 * A vendor's `risk_tier` is a static classification set at onboarding — it says
 * "this is a critical supplier", not "here is the specific thing that could go
 * wrong, how likely it is, what we are doing about it and when we last looked".
 * Those live in the risk register, and until migration 142 there was no way to
 * say a named risk arises from a named vendor. This is the read side of that
 * link, shown during a vendor review.
 *
 * Read-only: linking happens on the risk, the same as assets, controls,
 * objectives and POA&Ms, so one screen owns the relationship.
 */

const SEVERITY_BANDS: Array<{ min: number; label: string; className: string }> = [
  { min: 15, label: 'Critical', className: 'bg-red-100 text-red-700' },
  { min: 10, label: 'High', className: 'bg-orange-100 text-orange-700' },
  { min: 5, label: 'Medium', className: 'bg-yellow-100 text-yellow-700' },
  { min: 1, label: 'Low', className: 'bg-green-100 text-green-700' },
];

// Scores are likelihood x impact on a 1-5 scale, so 1-25.
function band(score: number | null) {
  if (score === null || score === undefined) {
    return { label: 'Unscored', className: 'bg-gray-100 text-gray-600' };
  }
  return SEVERITY_BANDS.find((entry) => score >= entry.min)
    ?? { label: 'Low', className: 'bg-green-100 text-green-700' };
}

const TIER_RANK: Record<string, number> = { critical: 15, high: 10, medium: 5, low: 1 };

interface VendorRisk {
  id: string;
  title: string;
  category: string;
  status: string;
  inherent_score: number | null;
  residual_score: number | null;
  link_notes: string | null;
}

interface VendorRiskLinksProps {
  vendorId: string;
  /** The vendor's onboarding classification, for the disagreement check below. */
  riskTier?: string;
}

export default function VendorRiskLinks({ vendorId, riskTier }: VendorRiskLinksProps) {
  const [risks, setRisks] = useState<VendorRisk[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [maxResidual, setMaxResidual] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tprmAPI.getVendor(vendorId);
      const data = res.data?.data;
      setRisks(Array.isArray(data?.risks) ? data.risks : []);
      setOpenCount(typeof data?.open_risk_count === 'number' ? data.open_risk_count : 0);
      setMaxResidual(typeof data?.max_residual_score === 'number' ? data.max_residual_score : null);
      setError('');
    } catch {
      setError('Could not load linked risks.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  // The check worth making during a review: a vendor tiered 'low' that is
  // carrying an open critical risk is a classification that has gone stale.
  const tierRank = riskTier ? TIER_RANK[riskTier] ?? 0 : 0;
  const understated = maxResidual !== null && tierRank > 0 && maxResidual >= tierRank + 5;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">
          Register Risks {openCount > 0 && <span className="text-gray-500">({openCount} open)</span>}
        </h4>
        <Link href="/dashboard/risks" className="text-xs text-purple-600 hover:text-purple-800 font-medium">
          Risk register →
        </Link>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {understated && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1 mb-2">
          This vendor is tiered <strong>{riskTier}</strong> but carries an open risk scoring{' '}
          {maxResidual}. Worth revisiting the tier during this review.
        </p>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : risks.length === 0 ? (
        <p className="text-xs text-gray-500">
          No register risks linked. The vendor tier records how important this supplier is;
          it does not record what could go wrong. Add a risk in the register and link this
          vendor to it.
        </p>
      ) : (
        <ul role="list" className="space-y-2">
          {risks.map((risk) => {
            const residual = band(risk.residual_score);
            return (
              <li key={risk.id} role="listitem" className="border border-gray-200 rounded-lg p-2">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/risks/${risk.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-purple-700 truncate"
                  >
                    {risk.title}
                  </Link>
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${residual.className}`}>
                    {residual.label}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="capitalize">{risk.category.replace(/_/g, ' ')}</span>
                  <span>·</span>
                  <span className="capitalize">{risk.status.replace(/_/g, ' ')}</span>
                  <span>·</span>
                  <span>inherent {risk.inherent_score ?? '—'} → residual {risk.residual_score ?? '—'}</span>
                </div>
                {risk.link_notes && (
                  <p className="mt-1 text-xs text-gray-600">{risk.link_notes}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
