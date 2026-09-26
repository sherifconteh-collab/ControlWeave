'use client';

import { useState } from 'react';
import { HipaaAddressableDecision, HipaaSraAnswer, hipaaSraAPI } from '@/lib/api';
import { errorMessage, inputClass } from '@/components/policies/policyShared';

export interface SraQuestion {
  id: string;
  control_id: string;
  title: string;
  description: string | null;
  level: 'required' | 'addressable' | 'standard';
  answer: HipaaSraAnswer | null;
  addressable_decision: HipaaAddressableDecision | null;
  threat: string | null;
  vulnerability: string | null;
  likelihood: number | null;
  impact: number | null;
  risk_score: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  notes: string | null;
  risk_id: string | null;
}

const ANSWER_OPTIONS: { value: HipaaSraAnswer; label: string }[] = [
  { value: 'implemented', label: 'Implemented' },
  { value: 'partially_implemented', label: 'Partially' },
  { value: 'not_implemented', label: 'Not implemented' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const DECISIONS: { value: HipaaAddressableDecision; label: string }[] = [
  { value: 'implemented', label: 'Implemented as specified' },
  { value: 'alternative_measure', label: 'Equivalent alternative measure implemented' },
  { value: 'not_reasonable', label: 'Not reasonable and appropriate (rationale documented)' },
];

const SCALE = [1, 2, 3, 4, 5];
const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

interface SraQuestionCardProps {
  assessmentId: string;
  question: SraQuestion;
  readOnly: boolean;
  onSaved: () => void;
}

export default function SraQuestionCard({ assessmentId, question, readOnly, onSaved }: SraQuestionCardProps) {
  const [draft, setDraft] = useState<SraQuestion>(question);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isGap = draft.answer === 'partially_implemented' || draft.answer === 'not_implemented';

  const update = (patch: Partial<SraQuestion>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await hipaaSraAPI.saveResponse(assessmentId, question.id, {
        answer: draft.answer,
        addressable_decision: draft.level === 'addressable' ? draft.addressable_decision : null,
        threat: isGap ? draft.threat : null,
        vulnerability: isGap ? draft.vulnerability : null,
        likelihood: isGap ? draft.likelihood : null,
        impact: isGap ? draft.impact : null,
        notes: draft.notes,
      });
      setDirty(false);
      onSaved();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const score = draft.likelihood && draft.impact ? draft.likelihood * draft.impact : null;
  const citation = question.control_id.replace(/^HIPAA-/, '');

  return (
    <div className="border border-gray-200 rounded-md p-3 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-gray-900">{question.title}</div>
          <div className="text-xs text-gray-500">45 CFR {citation}</div>
        </div>
        <div className="flex items-center gap-2">
          {question.level !== 'standard' && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${question.level === 'required' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'}`}>
              {question.level === 'required' ? 'Required' : 'Addressable'}
            </span>
          )}
          {question.severity && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SEVERITY_STYLES[question.severity]}`} aria-label={`Risk ${question.severity}`}>
              Risk {question.risk_score} ({question.severity})
            </span>
          )}
        </div>
      </div>
      {question.description && <p className="text-xs text-gray-600 mt-2">{question.description}</p>}

      <fieldset className="mt-3" disabled={readOnly}>
        <legend className="sr-only">How is this requirement met?</legend>
        <div className="flex flex-wrap gap-2">
          {ANSWER_OPTIONS.map((opt) => (
            <label key={opt.value} htmlFor={`${question.id}-${opt.value}`} className={`text-xs border rounded px-2 py-1 cursor-pointer ${draft.answer === opt.value ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-700'}`}>
              <input id={`${question.id}-${opt.value}`} type="radio" className="sr-only" name={`answer-${question.id}`} checked={draft.answer === opt.value} onChange={() => update({ answer: opt.value })} />
              {opt.label}
            </label>
          ))}
        </div>

        {question.level === 'addressable' && draft.answer && draft.answer !== 'implemented' && (
          <div className="mt-3">
            <label htmlFor={`${question.id}-decision`} className="block text-xs font-medium text-gray-700 mb-1">Addressable decision</label>
            <select id={`${question.id}-decision`} className={inputClass} value={draft.addressable_decision || ''} onChange={(e) => update({ addressable_decision: (e.target.value || null) as HipaaAddressableDecision | null })}>
              <option value="">Select a decision</option>
              {DECISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        )}

        {isGap && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${question.id}-threat`} className="block text-xs font-medium text-gray-700 mb-1">Threat</label>
              <input id={`${question.id}-threat`} className={inputClass} value={draft.threat || ''} onChange={(e) => update({ threat: e.target.value })} placeholder="e.g. ransomware, lost laptop, insider misuse" />
            </div>
            <div>
              <label htmlFor={`${question.id}-vuln`} className="block text-xs font-medium text-gray-700 mb-1">Vulnerability</label>
              <input id={`${question.id}-vuln`} className={inputClass} value={draft.vulnerability || ''} onChange={(e) => update({ vulnerability: e.target.value })} placeholder="e.g. no MFA on remote access" />
            </div>
            <div>
              <label htmlFor={`${question.id}-likelihood`} className="block text-xs font-medium text-gray-700 mb-1">Likelihood (1-5)</label>
              <select id={`${question.id}-likelihood`} className={inputClass} value={draft.likelihood || ''} onChange={(e) => update({ likelihood: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-</option>
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${question.id}-impact`} className="block text-xs font-medium text-gray-700 mb-1">Impact (1-5)</label>
              <select id={`${question.id}-impact`} className={inputClass} value={draft.impact || ''} onChange={(e) => update({ impact: e.target.value ? Number(e.target.value) : null })}>
                <option value="">-</option>
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="mt-3">
          <label htmlFor={`${question.id}-notes`} className="block text-xs font-medium text-gray-700 mb-1">Notes and evidence</label>
          <textarea id={`${question.id}-notes`} rows={2} className={inputClass} value={draft.notes || ''} onChange={(e) => update({ notes: e.target.value })} placeholder="How it is met, or the rationale for the decision" />
        </div>
      </fieldset>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {score ? `Risk score ${score}` : ''}
          {question.risk_id ? ' - added to the risk register' : ''}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-700" role="alert">{error}</span>}
            <button type="button" className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white disabled:opacity-40" disabled={!dirty || saving || !draft.answer} onClick={save}>
              {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
