import React from 'react';
import { MetricEvidence } from '../types';

const labels: Record<MetricEvidence['type'], string> = {
  live_api: 'LIVE API',
  derived: 'DERIVED',
  simulation: 'SIMULATION',
  estimated_fallback: 'ESTIMATE',
  cached: 'CACHED',
  reference: 'REFERENCE',
};

export const EvidenceBadge: React.FC<{ evidence?: MetricEvidence; cached?: boolean }> = ({ evidence, cached = false }) => {
  const label = cached ? 'CACHED' : evidence ? labels[evidence.type] : 'NO EVIDENCE';
  const title = cached
    ? 'Displayed from the saved journey snapshot.'
    : evidence
      ? `${evidence.source}: ${evidence.detail}${evidence.observedAt ? ` Observed ${evidence.observedAt}.` : ''}`
      : 'No provenance was supplied for this value.';
  return (
    <span
      title={title}
      className="inline-flex px-1 py-0.5 rounded border border-slate-600 bg-slate-950/70 text-[8px] font-bold tracking-wide text-slate-400"
    >
      {label}
    </span>
  );
};
