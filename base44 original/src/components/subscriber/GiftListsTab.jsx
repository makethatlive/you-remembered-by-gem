import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";

const TYPE_LABEL = {
  curated: "Curated picks",
  last_minute: "Last minute ideas",
  experience_digital: "Experiences & digital",
};

export default function GiftListsTab({ subscriber, onOpen }) {
  // Always refetch on mount so a subscriber logging in after Gem approves a list
  // sees it immediately, rather than being served a stale (pre-approval) cache.
  const { data: recipients = [] } = useQuery({
    queryKey: ["recipients", subscriber?.id],
    queryFn: () => base44.entities.Recipient.filter({ subscriber_id: subscriber.id }),
    enabled: !!subscriber,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const { data: lists = [] } = useQuery({
    queryKey: ["giftlists", subscriber?.id],
    queryFn: () => base44.entities.GiftList.filter({ subscriber_id: subscriber.id }),
    enabled: !!subscriber,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["giftitems-subscriber", subscriber?.id],
    queryFn: () => base44.entities.GiftItem.list("-created_date", 5000),
    enabled: !!subscriber,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const visible = lists.filter((l) => l.visible_to_subscriber === true);

  const activeCount = (listId) =>
    items.filter((i) => i.gift_list_id === listId && i.status === "active").length;
  const recipName = (id) => recipients.find((r) => r.id === id)?.name || "";

  // Group by recipient, lists ordered by birthday_date ascending.
  const groups = recipients
    .map((r) => ({
      recipient: r,
      lists: visible
        .filter((l) => l.recipient_id === r.id)
        .sort((a, b) => new Date(a.birthday_date) - new Date(b.birthday_date)),
    }))
    .filter((g) => g.lists.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-5 pt-6">
      <h1 className="font-display text-2xl sm:text-3xl text-brand-dark mb-6">Your Gift Lists</h1>

      {groups.length === 0 ? (
        <p className="font-body text-sm text-brand-dark/50 text-center py-12">
          Your gift lists will appear here once they're ready. Add your people in the My People tab to get started.
        </p>
      ) : (
        <div className="space-y-7 pb-4">
          {groups.map(({ recipient, lists: rLists }) => (
            <div key={recipient.id}>
              <h2 className="font-display text-lg text-brand-dark mb-3">{recipient.name}</h2>
              <div className="space-y-3">
                {rLists.map((l) => {
                  const count = activeCount(l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => onOpen(l.id)}
                      className="w-full flex items-center gap-4 bg-brand-cream-card rounded-2xl shadow-sm p-4 text-left min-h-[44px] transition-transform active:scale-[0.99]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-xs uppercase tracking-wide text-brand-gold font-semibold">
                          {TYPE_LABEL[l.list_type]}
                        </p>
                        <p className="font-body text-sm text-brand-dark/55 mt-0.5">
                          Birthday {formatDate(l.birthday_date)}
                        </p>
                        <p className="font-body text-xs text-brand-dark/45 mt-0.5">
                          {count} {count === 1 ? "gift" : "gifts"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-brand-dark/30 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
