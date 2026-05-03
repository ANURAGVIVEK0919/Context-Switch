import React from 'react';
import { Info } from 'lucide-react';

export default function InfoTooltip({ text, className = '' }) {
  if (!text) return null;

  return (
    <span className={`relative inline-flex items-center align-middle ml-1 group ${className}`} aria-label={text}>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-outline/70 bg-surface text-tertiary cursor-help transition-colors group-hover:border-primary-container group-hover:text-on-surface">
        <Info size={10} strokeWidth={2.5} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded border border-outline bg-[color:var(--color-tooltip-bg)] px-3 py-2 text-[11px] leading-snug text-on-surface shadow-xl group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
