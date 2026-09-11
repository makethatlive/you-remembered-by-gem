import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Cake, Gift, Loader2, Sparkles, Trash2, User } from "lucide-react";
import { daysUntil, formatShortDate, gbp, LIST_LABEL, STATUS_LABEL, AGE_BAND_LABEL, GENDER_LABEL } from "@/lib/format";
import { useAdminData } from "@/lib/useAdminData";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColor = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIALLING: "bg-blue-100 text-blue-700",
  PAST_DUE: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  // Legacy lowercase support
  active: "bg-emerald-100 text-emerald-700",
  trialling: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusPill = {
  // Uppercase (from database)
  GENERATING: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  // Legacy lowercase support
  generating: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  sent: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const statusLabel = {
  // Uppercase (from database)
  GENERATING: "generating",
  PENDING_APPROVAL: "pending approval",
  APPROVED: "approved",
  SENT: "sent",
  REJECTED: "rejected",
  // Legacy lowercase support
  generating: "generating",
  pending_approval: "pending approval",
  approved: "approved",
  sent: "sent",
  rejected: "rejected",
};

export default function SubscriberDetail({ subscriber, onBack }) {
  const queryClient = useQueryClient();
  const { recipients, lists } = useAdminData();
  const [generatingFor, setGeneratingFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const myRecipients = recipients.filter((r) => r.subscriberId === subscriber.id);
  const listsFor = (recipientId) =>
    lists.filter((l) => l.recipientId === recipientId).sort((a, b) => daysUntil(a.birthdayDate) - daysUntil(b.birthdayDate));

  const generate = async (recipient) => {
    setGeneratingFor(recipient.id);
    try {
      const res = await base44.functions.invoke("generateGiftList", {
        recipient_id: recipient.id,
        list_type: "curated",
        days_until: daysUntil(recipient.birthday),
      });
      
      const data = res?.data;
      
      if (data?.status === "pending_approval") {
        toast({ description: `✅ Gift list generated for ${recipient.name} — it's now in your approval queue.` });
      } else if (data?.status === "rejected") {
        toast({ description: `⚠️ Couldn't build a clean list for ${recipient.name} — flagged for you to review.` });
      } else if (data?.status === "quality_check_failed") {
        // Show detailed quality failure reasons
        const reasons = data.failedReasons?.join(", ") || "Quality standards not met";
        const giftCount = data.giftsGenerated || 0;
        toast({ 
          title: `❌ Quality Check Failed for ${recipient.name}`,
          description: `Generated ${giftCount} gifts but rejected: ${reasons}. Try adjusting interests or add more products to catalogue.`,
          variant: "destructive",
          duration: 8000,
        });
      } else if (data?.status === "insufficient_products") {
        // Not enough products in catalogue
        const candidatesFound = data.candidatesFound || 0;
        toast({ 
          title: `⚠️ Insufficient Products for ${recipient.name}`,
          description: `Only found ${candidatesFound} matching products (need at least 3). Add more products with interests: ${recipient.interests?.join(", ") || "their interests"}.`,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({ 
          title: "Generation Failed",
          description: data?.message || data?.error || "Couldn't generate a list right now — please try again.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["giftlists-all"] });
      queryClient.invalidateQueries({ queryKey: ["giftitems-all"] });
    } catch (err) {
      toast({ 
        title: "Error",
        description: err?.response?.data?.error || "Couldn't generate a list right now — please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const recipIds = myRecipients.map((r) => r.id);
      const myLists = lists.filter((l) => l.subscriberId === subscriber.id);
      const items = await base44.entities.GiftItem.list("-created_date", 5000);
      const listIds = new Set(myLists.map((l) => l.id));
      const orphanItems = items.filter((i) => listIds.has(i.giftListId));

      for (const item of orphanItems) await base44.entities.GiftItem.delete(item.id);
      for (const l of myLists) await base44.entities.GiftList.delete(l.id);
      for (const id of recipIds) await base44.entities.Recipient.delete(id);
      await base44.entities.Subscriber.delete(subscriber.id);

      toast({ description: `${subscriber.name}'s account and all their data have been removed.` });
      queryClient.invalidateQueries({ queryKey: ["subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["recipients-all"] });
      queryClient.invalidateQueries({ queryKey: ["giftlists-all"] });
      queryClient.invalidateQueries({ queryKey: ["giftitems-all"] });
      onBack();
    } catch {
      toast({ description: "Couldn't delete this account — please try again." });
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-8 sm:px-12 lg:px-16 pt-5 pb-16">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Profile */}
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-brand-teal/10 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-brand-teal" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl text-brand-dark truncate">{subscriber.name}</h1>
              <p className="font-body text-sm text-brand-dark/55 truncate">{subscriber.email}</p>
            </div>
          </div>
          <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColor[subscriber.subscriptionStatus || subscriber.subscription_status] || statusColor.ACTIVE}`}>
            {STATUS_LABEL[subscriber.subscriptionStatus || subscriber.subscription_status]}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 font-body text-sm text-brand-dark/60">
          <span><b className="text-brand-teal">{myRecipients.length}</b> people</span>
          <span><b className="text-brand-teal">{lists.filter((l) => l.subscriberId === subscriber.id).length}</b> gift lists</span>
          {subscriber.subscribedSince && <span className="text-brand-dark/40">Joined {formatShortDate(subscriber.subscribedSince)}</span>}
        </div>
      </div>

      {/* Recipients */}
      <h2 className="font-display text-xl text-brand-dark mb-3">Recipients</h2>
      {myRecipients.length === 0 ? (
        <p className="font-body text-sm text-brand-dark/50 bg-brand-cream-card rounded-2xl shadow-sm px-5 py-6 text-center mb-5">
          This subscriber hasn't added anyone yet.
        </p>
      ) : (
        <div className="space-y-4 mb-5">
          {myRecipients.map((r) => {
            const d = daysUntil(r.birthday);
            const recLists = listsFor(r.id);
            return (
              <div key={r.id} className="bg-brand-cream-card rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-brand-dark">{r.name}</p>
                    <p className="font-body text-sm text-brand-dark/50">
                      {r.relationship} · {GENDER_LABEL[r.gender] || r.gender} · {AGE_BAND_LABEL[r.ageBand] || r.ageBand}
                    </p>
                    <p className="font-body text-sm text-brand-dark/60 mt-1 flex items-center gap-1.5">
                      <Cake className="w-4 h-4 text-brand-gold" />
                      {formatShortDate(r.birthday)}
                      {d != null && <span className="text-brand-dark/40">· {d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} away`}</span>}
                    </p>
                    {(r.budgetMin != null || r.budgetMax != null) && (
                      <p className="font-body text-xs text-brand-dark/45 mt-1">
                        Budget {gbp(r.budgetMin)}–{gbp(r.budgetMax)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => generate(r)}
                    disabled={generatingFor === r.id}
                    className="inline-flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] shrink-0 hover:bg-brand-teal-dark disabled:opacity-50"
                  >
                    {generatingFor === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingFor === r.id ? "Generating…" : "Generate Gift List"}
                  </button>
                </div>

                {/* Gift lists / occasions */}
                <div className="mt-4 border-t border-brand-gold/15 pt-3">
                  {recLists.length === 0 ? (
                    <p className="font-body text-xs text-brand-dark/40">No gift lists yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recLists.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 font-body text-sm">
                          <span className="flex items-center gap-2 text-brand-dark/70 min-w-0">
                            <Gift className="w-4 h-4 text-brand-gold shrink-0" />
                            <span className="truncate">
                              {LIST_LABEL[l.listType]} · {new Date(l.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          </span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusPill[l.status] || "bg-slate-100 text-slate-600"}`}>
                            {statusLabel[l.status] || l.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete account */}
      <button
        onClick={() => setConfirmDelete(true)}
        className="inline-flex items-center gap-1.5 text-red-600 font-body text-sm font-medium min-h-[44px] hover:text-red-700"
      >
        <Trash2 className="w-4 h-4" /> Delete subscriber account
      </button>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete {subscriber.name}?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This permanently removes {subscriber.name}'s account along with their {myRecipients.length} recipient{myRecipients.length === 1 ? "" : "s"} and all gift lists. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-body bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); deleteAccount(); }}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
