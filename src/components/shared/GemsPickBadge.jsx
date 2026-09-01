import React from "react";
import { Sparkles } from "lucide-react";

// Shown only for products personally curated by Gem (source_type "curated_product").
export default function GemsPickBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-brand-gold text-white text-[10px] font-bold font-body px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}
    >
      <Sparkles className="w-3 h-3" /> Gem's Pick
    </span>
  );
}