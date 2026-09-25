import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ExternalLink, AlertTriangle, RefreshCw, Check, Heart, ThumbsDown } from "lucide-react";
import { formatDate, gbp } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_LABEL = {
  curated: "Curated picks",
  last_minute: "Last minute ideas",
  experience_digital: "Experiences & digital",
};

export default function GiftListView({ listId, onBack }) {
  const queryClient = useQueryClient();
  // Items hidden client-side after a broken-link report (GiftItem status is never changed).
  const [hidden, setHidden] = useState([]);
  const [reportItem, setReportItem] = useState(null);
  // If an image URL fails to load, fall back to the existing clean cream panel.
  // onError fires once per item and removes the <img>, so it can never loop.
  const [broken, setBroken] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshReason, setRefreshReason] = useState("");

  const { data: list } = useQuery({
    queryKey: ["giftlist", listId],
    queryFn: () => base44.entities.GiftList.get(listId),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["giftitems", listId],
    queryFn: () => base44.entities.GiftItem.filter({ gift_list_id: listId }),
  });
  const { data: recipient } = useQuery({
    queryKey: ["recipient", list?.recipient_id],
    queryFn: () => base44.entities.Recipient.get(list.recipient_id),
    enabled: !!list?.recipient_id,
  });

  const visibleItems = items
    .filter((i) => i.status?.toUpperCase() === "ACTIVE" && !hidden.includes(i.id))
    .slice(0, 5); // Only show top 5 items

  // Removed standby/backup items - not shown to subscribers

  const confirmReport = async () => {
    const item = reportItem;
    setReportItem(null);
    if (!item) return;
    setHidden((h) => [...h, item.id]);
    try {
      const result = await base44.functions.invoke("reportBrokenGift", { gift_item_id: item.id });
      if (result?.data?.error) throw new Error(result.data.error);
      await queryClient.invalidateQueries({ queryKey: ["giftitems", listId] });
    } catch {
      setHidden((current) => current.filter((id) => id !== item.id));
    }
  };

  // field is "feedback" or "subscriber_action"; clicking the already-active value is a no-op.
  const submitFeedback = async (item, field, value) => {
    if (item[field] === value) return;
    try {
      const result = await base44.functions.invoke("submitGiftFeedback", {
        gift_item_id: item.id,
        [field]: value,
      });
      if (result?.data?.error) throw new Error(result.data.error);
      await queryClient.invalidateQueries({ queryKey: ["giftitems", listId] });
    } catch {
      // Feedback is best-effort: on failure the buttons stay as they were.
    }
  };

  const requestRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage("");
    setRefreshOpen(false);
    try {
      const result = await base44.functions.invoke("requestGiftRefresh", {
        gift_list_id: listId,
        refresh_reason: refreshReason.trim().slice(0, 300) || undefined,
      });
      const data = result?.data || {};
      if (data.error) throw new Error(data.error);
      
      // Handle different response statuses
      if (data.status === "already_requested") {
        setRefreshMessage("Fresh ideas are already being curated for you.");
      } else if (data.status === "pending_approval") {
        setRefreshMessage(data.message || "Your request has been sent to admin for approval. You'll receive new gift suggestions once reviewed.");
      } else {
        setRefreshMessage("Your refresh is with Gem. This list will update after the new ideas have been checked.");
      }
    } catch (error) {
      // invoke rejects on any non-2xx and error.message is only "Request failed with
      // status code N" — the real body is on error.response.data. Never show the raw one.
      setRefreshMessage(error?.response?.data?.error || "We couldn't request fresh ideas just now. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-8 sm:px-12 lg:px-16 pt-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {list && (
        <div className="mb-5">
          <p className="font-body text-xs uppercase tracking-wide text-brand-gold font-semibold">
            {TYPE_LABEL[list.listType]}
          </p>
          <h1 className="font-display text-2xl text-brand-dark leading-tight mt-1">
            Gifts for {recipient?.name}
          </h1>
          <p className="font-body text-sm text-brand-dark/50">
            Birthday {formatDate(list.birthdayDate)}
          </p>
        </div>
      )}

      {visibleItems.length === 0 ? (
        <p className="font-body text-sm text-brand-dark/50 text-center py-12">
          We're refreshing this list — check back soon.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
            {visibleItems.map((item, index) => {
              const link = item.affiliate_url || item.product_url;
              const hasImage = item.imageUrl && !broken[item.id];
              
              return (
                <div key={item.id} className="bg-brand-cream-card rounded-2xl shadow-md overflow-hidden border border-brand-gold/10 hover:shadow-lg transition-shadow">
                  <div className="h-56 bg-brand-cream relative">
                    {hasImage ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        onError={() => setBroken((b) => ({ ...b, [item.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-cream to-brand-gold-soft/20">
                        <svg className="w-24 h-24 text-brand-gold/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-brand-teal text-brand-cream font-body text-sm font-bold rounded-full w-9 h-9 flex items-center justify-center shadow-md">
                      {index + 1}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-display text-lg text-brand-dark leading-tight line-clamp-2">{item.title}</p>
                      <span className="font-body text-base text-brand-gold font-bold whitespace-nowrap">
                        {gbp(item.price)}
                      </span>
                    </div>
                    {item.retailerName && (
                      <p className="font-body text-xs text-brand-teal font-medium mt-1">{item.retailerName}</p>
                    )}
                    {item.why_this_gift && (
                      <div className="mt-3 p-2.5 bg-brand-gold-soft/20 rounded-lg">
                        <p className="font-body text-xs text-brand-dark/80 leading-relaxed line-clamp-3">{item.why_this_gift}</p>
                      </div>
                    )}
                    <div className="mt-4 space-y-2">
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 bg-brand-teal text-brand-cream font-body text-sm font-semibold rounded-xl px-4 py-2.5 min-h-[44px] transition-colors hover:bg-brand-teal-dark shadow-sm"
                        >
                          View Product <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setReportItem(item)}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-brand-dark/40 font-body text-xs font-medium min-h-[40px] hover:text-brand-dark/70 transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Report broken link
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ActionBtn active={item.subscriber_action === "purchased"} activeClass="bg-brand-teal text-brand-cream" onClick={() => submitFeedback(item, "subscriber_action", "purchased")} icon={Check} label="Purchased" />
                      <ActionBtn active={item.subscriber_action === "not_purchased"} activeClass="bg-brand-dark/80 text-brand-cream" onClick={() => submitFeedback(item, "subscriber_action", "not_purchased")} label="Didn't Buy" />
                      <ActionBtn active={item.feedback === "loved_it"} activeClass="bg-rose-500 text-white" onClick={() => submitFeedback(item, "feedback", "loved_it")} icon={Heart} label="Loved It" />
                      <ActionBtn active={item.feedback === "bad_suggestion"} activeClass="bg-amber-500 text-white" onClick={() => submitFeedback(item, "feedback", "bad_suggestion")} icon={ThumbsDown} label="Not Right" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-4 pb-8 text-center border-t border-brand-gold/20">
            <button
              type="button"
              disabled={refreshing || !!refreshMessage}
              onClick={() => setRefreshOpen(true)}
              className="inline-flex items-center gap-2 border-2 border-brand-gold/60 text-brand-teal font-body text-sm font-semibold rounded-xl px-6 py-3 min-h-[48px] hover:bg-brand-gold-soft/20 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Requesting fresh ideas…" : "Refresh these suggestions"}
            </button>
            {refreshMessage && <p className="font-body text-sm text-brand-dark/60 mt-3">{refreshMessage}</p>}
          </div>
        </>
      )}

      <AlertDialog open={!!reportItem} onOpenChange={(o) => !o && setReportItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report broken link</AlertDialogTitle>
            <AlertDialogDescription>
              Report this link as broken? We'll remove it and find you an alternative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReport}>Report</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refreshOpen} onOpenChange={setRefreshOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh these suggestions</AlertDialogTitle>
            <AlertDialogDescription>
              Gem will curate a fresh set of ideas. Optionally, tell her why — it helps her pick better.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={refreshReason}
            onChange={(e) => setRefreshReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="e.g. These feel too practical — she'd love something more sentimental"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={requestRefresh}>Request fresh ideas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
