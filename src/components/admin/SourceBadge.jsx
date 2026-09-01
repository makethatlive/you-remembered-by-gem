import React from "react";
import { Sparkles } from "lucide-react";
import { provenanceGroup, sourceLabel } from "@/lib/provenance";

// Admin-side provenance pill — makes a Gem's Pick unmistakable at a glance
// (Kate item 5). Deliberately separate from shared/GemsPickBadge.jsx: that one
// is subscriber-facing and renders only the curated state; this one renders all
// three provenance groups.
const GROUP_STYLE = {
  gem_pick: "bg-brand-gold/20 text-brand-dark ring-1 ring-brand-gold/50",
  catalogue: "bg-brand-teal/10 text-brand-teal",
  legacy: "bg-brand-dark/10 text-brand-dark/60",
};

export default function SourceBadge({ product }) {
  const group = provenanceGroup(product);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-body font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${GROUP_STYLE[group]}`}
    >
      {group === "gem_pick" && <Sparkles className="w-3 h-3 text-brand-gold" />}
      {sourceLabel(product)}
    </span>
  );
}
