import React from "react";

// Auto-created-retailers report block for CuratedImportPanel (P11 below), split
// out into its own file per the house one-component-per-file rule.
export default function CuratedRetailersReport({ retailers }) {
  if (!retailers || retailers.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="font-body text-xs uppercase tracking-wide text-brand-dark/40">
        Auto-created retailers ({retailers.length})
      </p>
      {retailers.map((r, i) => (
        <p key={`${r.name}-${i}`} className="font-body text-sm text-brand-dark/55">
          {r.name} — {r.category} — {r.website_url}
        </p>
      ))}
    </div>
  );
}
