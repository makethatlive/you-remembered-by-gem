import React from "react";
import { Pencil, Trash2, Cake } from "lucide-react";
import { daysUntil, formatShortDate } from "@/lib/format";
import CountdownBadge from "./CountdownBadge";

export default function RecipientCard({ recipient, onEdit, onDelete }) {
  const days = daysUntil(recipient.birthday);
  return (
    <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xl text-brand-dark leading-tight">{recipient.name}</p>
          <p className="font-body text-sm text-brand-dark/50">{recipient.relationship}</p>
        </div>
        <CountdownBadge days={days} />
      </div>
      <div className="flex items-center gap-1.5 mt-4 text-brand-dark/60">
        <Cake className="w-4 h-4 text-brand-gold" />
        <span className="font-body text-sm">{formatShortDate(recipient.birthday)}</span>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onEdit(recipient)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-brand-teal/20 text-brand-teal font-body text-sm font-medium py-2.5 min-h-[44px] hover:bg-brand-teal/5"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
        <button
          onClick={() => onDelete(recipient)}
          className="flex items-center justify-center rounded-xl border border-red-200 text-red-500 px-3.5 min-h-[44px] hover:bg-red-50"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}