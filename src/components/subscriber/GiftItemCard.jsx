import React, { useState } from "react";
import { Heart, ThumbsDown, Check, ExternalLink } from "lucide-react";
import { gbp } from "@/lib/format";
import GemsPickBadge from "@/components/shared/GemsPickBadge";

export default function GiftItemCard({ item, state, onAction }) {
  // If the image URL fails to load, fall back to the existing clean cream panel.
  // onError fires once and removes the <img>, so it can never loop.
  const [imgBroken, setImgBroken] = useState(false);
  const purchased = state?.action === "purchased";
  const notBought = state?.action === "not_purchased";
  const loved = state?.feedback === "loved_it";
  const notRight = state?.feedback === "bad_suggestion";

  return (
    <div className="bg-brand-cream-card rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row">
      <div className="relative md:w-44 h-48 md:h-auto bg-brand-cream shrink-0">
        {(item.sourceType || item.source_type) === "curated_product" && (
          <GemsPickBadge className="absolute top-2 left-2 z-10" />
        )}
        {item.imageUrl && !imgBroken && (
          <img
            src={item.imageUrl}
            alt={item.title}
            onError={() => setImgBroken(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg text-brand-dark leading-tight">{item.title}</h3>
          <span className="font-display text-lg text-brand-gold font-semibold whitespace-nowrap">{gbp(item.price)}</span>
        </div>
        <p className="font-body text-sm text-brand-gold mt-0.5">{item.retailerName}</p>
        <p className="font-body text-sm text-brand-dark/60 mt-2">{item.description}</p>
        {item.why_this_gift && (
          <p className="font-body text-xs italic text-brand-dark/50 mt-2 border-l-2 border-brand-gold/40 pl-2">
            Gem's note: {item.why_this_gift}
          </p>
        )}

        <a
          href={item.product_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mt-3 hover:underline"
        >
          Buy Now <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <ActionBtn active={purchased} activeClass="bg-brand-teal text-brand-cream" onClick={() => onAction(item.id, "action", "purchased")} icon={Check} label="Purchased" />
          <ActionBtn active={notBought} activeClass="bg-brand-dark/80 text-brand-cream" onClick={() => onAction(item.id, "action", "not_purchased")} label="Didn't Buy" />
          <ActionBtn active={loved} activeClass="bg-rose-500 text-white" onClick={() => onAction(item.id, "feedback", "loved_it")} icon={Heart} label="Loved It" />
          <ActionBtn active={notRight} activeClass="bg-amber-500 text-white" onClick={() => onAction(item.id, "feedback", "bad_suggestion")} icon={ThumbsDown} label="Not Right" />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ active, activeClass, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 min-h-[44px] font-body text-sm font-medium transition-colors ${
        active ? activeClass : "bg-brand-cream text-brand-dark/70 hover:bg-brand-gold-soft/40"
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />} {label}
    </button>
  );
}