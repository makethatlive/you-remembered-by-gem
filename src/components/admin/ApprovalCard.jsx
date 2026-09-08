import React, { useState } from "react";
import { Cake, Pencil, RefreshCw } from "lucide-react";
import { gbp, LIST_LABEL, formatShortDate, daysUntil } from "@/lib/format";
import ApprovalItemEditor from "./ApprovalItemEditor";
import GemsPickBadge from "@/components/shared/GemsPickBadge";

export default function ApprovalCard({ list, subscriber, recipient, items, onApprove, onReject, onUpdateItem, onReplaceItems }) {
  const [editingItemId, setEditingItemId] = useState(null);
  // This card renders many items, so broken-image state is tracked per item id —
  // a single boolean would blank every thumbnail after one failure.
  // onError fires once per item and removes that <img>, so it can never loop.
  const [broken, setBroken] = useState({});
  const days = daysUntil(list.birthday_date);
  const urgent = days != null && days <= 15;

  return (
    <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display text-base text-brand-dark font-semibold">{subscriber?.name?.split(" ")[0]}</p>
          <p className="font-body text-sm text-brand-dark/50">
            {recipient?.name} — {recipient?.relationship}
          </p>
        </div>
        <div className="flex items-center gap-3 text-brand-dark/60">
          <span className="flex items-center gap-1 font-body text-sm">
            <Cake className="w-4 h-4 text-brand-gold" /> {formatShortDate(list.birthdayDate)}
          </span>
          <span className="font-body text-sm text-brand-teal font-medium">{LIST_LABEL[list.listType]}</span>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={() => onReplaceItems(list)}
          className="inline-flex items-center justify-center gap-2 border border-brand-gold/60 text-brand-teal font-body text-sm font-medium rounded-xl px-4 py-2.5 min-h-[44px] hover:bg-brand-gold-soft/20"
        >
          <RefreshCw className="w-4 h-4" /> Generate New List
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {items.map((item) => (
          <div key={item.id} className="bg-brand-cream rounded-xl p-3">
            <div className="relative h-28 rounded-lg overflow-hidden bg-brand-gold-soft/30">
              {(item.imageUrl || item.image_url) && !broken[item.id] && (
                <img
                  src={item.imageUrl || item.image_url}
                  alt={item.title}
                  onError={() => setBroken((b) => ({ ...b, [item.id]: true }))}
                  className="w-full h-full object-cover"
                />
              )}
              {urgent && (
                <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold font-body px-1.5 py-0.5 rounded">
                  URGENT
                </span>
              )}
              {(item.sourceType || item.source_type) === "curated_product" && (
                <GemsPickBadge className="absolute top-1.5 right-1.5" />
              )}
            </div>
            <div className="mt-2 flex items-start justify-between gap-1">
              <p className="font-display text-sm text-brand-dark leading-tight">{item.title}</p>
              <span className="font-body text-sm text-brand-gold font-semibold whitespace-nowrap">{gbp(item.price)}</span>
            </div>
            <p className="font-body text-xs text-brand-gold">{item.retailerName || item.retailer_name}</p>
            <p className="font-body text-xs italic text-brand-dark/50 mt-1 line-clamp-2">{item.description}</p>
            {(item.whyThisGift || item.why_this_gift) && (
              <p className="font-body text-xs text-brand-dark/60 mt-1 line-clamp-2">{item.whyThisGift || item.why_this_gift}</p>
            )}
            <div className="flex items-center justify-between gap-2 mt-2">
              <a
                href={item.productUrl || item.product_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-body text-xs text-brand-teal font-medium underline"
              >
                Buy
              </a>
              <button
                type="button"
                onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                className="inline-flex items-center gap-1 font-body text-xs text-brand-teal font-medium"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            {editingItemId === item.id && (
              <ApprovalItemEditor
                item={item}
                onSave={(draft) => {
                  onUpdateItem(list.id, item.id, draft);
                  setEditingItemId(null);
                }}
                onCancel={() => setEditingItemId(null)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <button
          onClick={() => onApprove(list.id)}
          className="bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal-dark"
        >
          Approve All
        </button>
        <button
          onClick={() => onReject(list.id)}
          className="border border-brand-teal/30 text-brand-teal font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal/5"
        >
          Reject
        </button>
      </div>
    </div>
  );
}