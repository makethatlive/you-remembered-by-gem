import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Gift } from "lucide-react";
import { daysUntil, LIST_LABEL } from "@/lib/format";
import CountdownBadge from "./CountdownBadge";

export default function Dashboard({ subscriber, onOpenList, onGoTab }) {
  const { data: recipients = [] } = useQuery({
    queryKey: ["recipients", subscriber?.id],
    queryFn: () => base44.entities.Recipient.filter({ subscriber_id: subscriber.id }),
    enabled: !!subscriber,
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["giftlists", subscriber?.id],
    queryFn: () => base44.entities.GiftList.filter({ subscriber_id: subscriber.id }),
    enabled: !!subscriber,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["giftitems-all"],
    queryFn: () => base44.entities.GiftItem.list("-created_date", 5000),
  });

  // Cover images that failed to load, keyed BY URL (not by list id) so a later
  // replacement image for the same list still displays. onError fires once per
  // URL and removes the <img>, so it can never loop.
  const [broken, setBroken] = useState({});

  const firstName = subscriber?.name?.split(" ")[0] || "there";
  const upcoming = [...recipients]
    .map((r) => ({ ...r, _days: daysUntil(r.birthday) }))
    .sort((a, b) => a._days - b._days);

  const readyLists = lists
    .filter((l) => l.status === "approved" || l.status === "sent")
    .filter((l) => l.visible_to_subscriber !== false)
    .filter((l) => daysUntil(l.birthday_date) <= 30);

  const recipName = (id) => recipients.find((r) => r.id === id)?.name || "";
  const listCover = (id) => items.find((i) => i.gift_list_id === id)?.image_url;
  const listForRecip = (id) => lists.find((l) => l.recipient_id === id);

  return (
    <div className="max-w-6xl mx-auto px-5 pt-6">
      <h1 className="font-display text-2xl sm:text-3xl text-brand-dark mb-6">
        Hello {firstName}, here's what's coming up
      </h1>

      <div className="space-y-3">
        {upcoming.map((r) => (
          <button
            key={r.id}
            onClick={() => { const gl = listForRecip(r.id); if (gl) onOpenList(gl.id); }}
            className="w-full flex items-center justify-between bg-brand-cream-card rounded-2xl shadow-sm px-5 py-4 min-h-[44px] text-left transition-transform active:scale-[0.99]"
          >
            <div>
              <p className="font-display text-lg text-brand-dark leading-tight">{r.name}</p>
              <p className="font-body text-sm text-brand-dark/50">{r.relationship}</p>
            </div>
            <div className="flex items-center gap-3">
              <CountdownBadge days={r._days} />
              <Gift className="w-5 h-5 text-brand-teal" />
            </div>
          </button>
        ))}
      </div>

      <h2 className="font-display text-xl text-brand-dark mt-8 mb-4">Gift Lists Ready</h2>
      <div className="space-y-4 pb-4">
        {readyLists.map((l) => (
          <div key={l.id} className="bg-brand-cream-card rounded-2xl shadow-sm p-3">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-brand-cream shrink-0">
                {listCover(l.id) && !broken[listCover(l.id)] && (
                  <img
                    src={listCover(l.id)}
                    alt=""
                    onError={() => setBroken((b) => ({ ...b, [listCover(l.id)]: true }))}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base text-brand-dark leading-tight">
                  {recipName(l.recipient_id)} &middot; {LIST_LABEL[l.list_type]}
                </p>
                <p className="font-body text-sm text-brand-gold font-medium">
                  {items.find((i) => i.gift_list_id === l.id)?.retailer_name || "Curated selection"}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenList(l.id)}
              className="mt-3 w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3 min-h-[44px] transition-colors hover:bg-brand-teal-dark"
            >
              View List
            </button>
          </div>
        ))}
        {readyLists.length === 0 && (
          <p className="font-body text-sm text-brand-dark/50 text-center py-8">
            Gem is curating your first lists — they'll appear here soon.
          </p>
        )}
      </div>
    </div>
  );
}
