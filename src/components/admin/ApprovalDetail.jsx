import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ArrowUpCircle, ArrowDownCircle, X, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { gbp, LIST_LABEL, formatShortDate, AGE_BAND_LABEL, GENDER_LABEL } from "@/lib/format";
import { toast } from "@/components/ui/use-toast";
import ManualGiftForm from "@/components/admin/ManualGiftForm";
import CatalogSwapPicker from "@/components/admin/CatalogSwapPicker";
import GemsPickBadge from "@/components/shared/GemsPickBadge";
import { TAXONOMY_VERSION } from "@/components/shared/taxonomy";

const MAX_ACTIVE = 5;
// Floor Gem can shuffle down to mid-curation (demote); a full five are required to approve.
const MIN_ACTIVE = 3;
const MIN_ACTIVE_APPROVE = 5;
const MIN_STANDBY_SILENT = 5;
const REMOVAL_REASONS = [
  ["wrong_age", "Wrong age"],
  ["wrong_audience", "Wrong recipient or audience"],
  ["not_relevant", "Doesn't match their interests"],
  ["too_generic", "Too generic"],
  ["duplicate", "Duplicate or too similar"],
  ["poor_quality", "Not special enough"],
  ["bad_link_or_data", "Bad link or product data"],
  ["other", "Other"],
];

// Render array fields (interests, personality, gift_types) as a readable comma list.
function arr(v) {
  return Array.isArray(v) && v.length ? v.join(", ") : null;
}

function ProfileRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <span className="block font-body text-xs font-semibold text-brand-dark/50">{label}</span>
      <span className="block font-body text-sm text-brand-dark">{value}</span>
    </div>
  );
}

// One gift idea card. `action` renders the section-specific button(s) on the card.
function GiftCard({ item, action }) {
  // If the image URL fails to load, fall back to the existing tinted panel.
  // onError fires once and removes the <img>, so it can never loop.
  const [broken, setBroken] = useState(false);
  const link = item.affiliateUrl || item.productUrl;
  return (
    <div className="bg-brand-cream-card rounded-2xl shadow-sm p-4">
      <div className="relative h-36 rounded-xl overflow-hidden bg-brand-gold-soft/30 mb-3">
        {(item.sourceType || item.source_type) === "curated_product" && (
          <GemsPickBadge className="absolute top-2 left-2 z-10" />
        )}
        {item.imageUrl && !broken && (
          <img
            src={item.imageUrl}
            alt={item.title}
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base text-brand-dark leading-tight">{item.title}</p>
        <span className="font-body text-sm text-brand-gold font-semibold whitespace-nowrap">
          {gbp(item.price)}
        </span>
      </div>
      {item.retailerName && (
        <p className="font-body text-xs text-brand-gold mt-0.5">{item.retailerName}</p>
      )}
      {item.description && (
        <p className="font-body text-sm italic text-brand-dark/60 mt-2">{item.description}</p>
      )}
      {item.whyThisGift && (
        <p className="font-body text-sm text-brand-dark/70 mt-2">{item.whyThisGift}</p>
      )}
      {item.aiFlagConcern && (
        <p className="font-body text-sm text-brand-dark/70 mt-2">AI flag: {item.aiFlagConcern}</p>
      )}
      {typeof item.suitabilityConfidence === "number" && (
        <p className="font-body text-xs text-brand-dark/45 mt-1">AI fit: {item.suitabilityConfidence}/5</p>
      )}
      <div className="flex items-center justify-between gap-2 mt-3">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-body text-sm text-brand-teal font-medium underline"
          >
            View product <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <div className="flex items-center gap-2 ml-auto">{action}</div>
      </div>
    </div>
  );
}

// Client-side twin of generateGiftList's profileHash (gg:383-405): FNV-1a 32-bit over
// the twelve hashed source fields PLUS the TAXONOMY_VERSION salt, in this exact order.
// The salt is the 13th element (gg:397, added by R1b) and is load-bearing: drop it and
// this hash never matches derived_profile_hash, so the badge below fires on every list.
// KEEP IN SYNC with R6 — if R6 ever changes the hash field set, the salt or the
// algorithm, this copy AND RecipientForm's GEN_RELEVANT_FIELDS (W7.3) must change in
// the same commit (comments point all three ways). budget_min/budget_max are
// Hash for checking if USER-EDITABLE fields changed (excludes TAXONOMY_VERSION)
function computeProfileHash(recipient) {
  const source = JSON.stringify([
    recipient.interests,
    recipient.personality,
    recipient.giftTypes,
    recipient.hobbiesAndInterests,
    recipient.whoTheyAre,
    recipient.thingsYouKnow,
    recipient.milestones,
    recipient.avoidNotes,
    recipient.notes,
    recipient.ageBand,
    recipient.gender,
    recipient.relationship,
    // TAXONOMY_VERSION removed - only check user-editable fields
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

export default function ApprovalDetail({ list, subscriber, recipient, onBack, onRegenerated }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addMode, setAddMode] = useState(null); // 'catalog' | 'manual' | null
  const [regenerating, setRegenerating] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalNote, setRemovalNote] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["giftitems-list", list.id],
    queryFn: () => base44.entities.GiftItem.filter({ gift_list_id: list.id }),
  });

  // Context for lists that supersede an earlier one: the subscriber's refresh reason
  // lives on the OLD list (requestGiftRefresh writes it there). refresh_reason is a
  // round-3 Layer-C field — absent on every record until publish; absence is normal.
  const { data: supersededList = null } = useQuery({
    queryKey: ["superseded-list", list.supersedesListId],
    queryFn: () => base44.entities.GiftList.get(list.supersedesListId).catch(() => null),
    enabled: !!list.supersedesListId,
  });

  // True when the recipient's CURRENT hashed fields differ from the profile the last
  // generation derived from. `updated_date` timestamps are UNUSABLE here: the finalise
  // block writes last_gift_generated onto the Recipient AFTER generated_at is stamped
  // (gg:1458 vs gg:1170) on every successful generation, and completePaidSignup bumps
  // updated_date during signup linkage (completePaidSignup/entry.ts:113) — a timestamp
  // comparison would badge essentially every list, forever. derived_profile_hash is
  // written by the derive cache (gg:493-496) and untouched on cache hits (gg:418-420),
  // so it always reflects the profile as last generated. No derived_profile_hash
  // (legacy recipient / failed derive) → no badge. Budget changes sit outside the
  // hash — already visible in the profile card below.
  const profileEditedAfterGeneration = !!(
    recipient?.derivedProfileHash &&
    computeProfileHash(recipient) !== recipient.derivedProfileHash
  );

  const activeItems = items.filter((i) => i.status === "ACTIVE");
  const standbyItems = items.filter((i) => i.status === "STANDBY");
  const activeCount = activeItems.length;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["giftitems-list", list.id] }),
      queryClient.invalidateQueries({ queryKey: ["giftitems-all"] }),
      queryClient.invalidateQueries({ queryKey: ["giftlists-all"] }),
    ]);
  };

  // Move a backup idea into the Top 5.
  const promote = async (item) => {
    if (activeCount >= MAX_ACTIVE) {
      toast({ description: "Top 5 is full — move one to backups first." });
      return;
    }
    setBusy(true);
    try {
      await base44.entities.GiftItem.update(item.id, { status: "active" });
      await refresh();
      toast({ description: `${item.title} moved to the Top 5.` });
    } catch (error) {
      console.error("Failed to promote gift:", error);
      toast({ description: "Couldn't promote this gift — please try again." });
    } finally {
      setBusy(false);
    }
  };

  // Move a Top 5 gift back to backups.
  const demote = async (item) => {
    if (activeCount <= MIN_ACTIVE) {
      toast({ description: `A list needs at least ${MIN_ACTIVE} active gifts.` });
      return;
    }
    setBusy(true);
    try {
      await base44.entities.GiftItem.update(item.id, { status: "standby" });
      await refresh();
      toast({ description: `${item.title} moved to backups.` });
    } catch (error) {
      console.error("Failed to demote gift:", error);
      toast({ description: "Couldn't move this gift — please try again." });
    } finally {
      setBusy(false);
    }
  };

  // Discard a gift entirely (no longer shown anywhere).
  const removeItem = async () => {
    const item = removeTarget;
    if (!item || !removalReason) {
      toast({ description: "Choose why this gift is unsuitable first." });
      return;
    }
    setBusy(true);
    try {
      await base44.entities.GiftItem.update(item.id, {
        status: "removed",
        admin_feedback_reason: removalReason,
        admin_feedback_note: removalNote.trim() || undefined,
      });
      setRemoveTarget(null);
      setRemovalReason("");
      setRemovalNote("");
      await refresh();
      toast({ description: `${item.title} removed.` });
    } catch (error) {
      console.error("Failed to remove gift:", error);
      toast({ description: "Couldn't remove this gift — please try again." });
    } finally {
      setBusy(false);
    }
  };

  // Add a hand-entered gift. Goes straight into the Top 5 if there's room, else backups.
  const addManual = async (fields) => {
    setBusy(true);
    try {
      await base44.entities.GiftItem.create({
        gift_list_id: list.id,
        // Carried from the parent list so item-level RLS can scope to the owning subscriber.
        subscriber_user_id: list.subscriberUserId || list.subscriber_user_id,
        product_id: "manual",
        // Hand-entered by Gem — personally curated provenance.
        source_type: "curated_product",
        status: activeCount < MAX_ACTIVE ? "active" : "standby",
        ...fields,
      });
      setAddMode(null);
      await refresh();
      toast({ description: "Gift added." });
    } catch (error) {
      console.error("Failed to add manual gift:", error);
      toast({ description: "Couldn't add this gift — please try again." });
    } finally {
      setBusy(false);
    }
  };

  // Swap in a gift picked directly from the Product catalogue.
  const addFromCatalog = async (product, retailerName) => {
    const duplicate = items.some((item) =>
      item.status !== "removed" && (
        item.product_id === product.id ||
        (item.product_url && item.product_url === (product.product_url || product.productUrl)) ||
        (item.title || "").trim().toLowerCase() === (product.name || "").trim().toLowerCase()
      )
    );
    if (duplicate) {
      toast({ description: "That product is already in this list." });
      return;
    }
    setBusy(true);
    try {
      await base44.entities.GiftItem.create({
        gift_list_id: list.id,
        // Carried from the parent list so item-level RLS can scope to the owning subscriber.
        subscriber_user_id: list.subscriberUserId || list.subscriber_user_id,
        product_id: product.id,
        title: product.name,
        description: product.description || "",
        why_this_gift: "",
        product_url: product.product_url || product.productUrl,
        affiliate_url: product.affiliate_url || product.affiliateUrl || product.product_url || product.productUrl,
        retailer_name: retailerName || "",
        price: product.price,
        image_url: product.image_url || product.imageUrl,
        // Provenance carried from the catalogue product.
        source_type: product.source_type || product.sourceType || "legacy_unknown",
        status: activeCount < MAX_ACTIVE ? "active" : "standby",
      });
      setAddMode(null);
      await refresh();
      toast({ description: `${product.name} added.` });
    } catch (error) {
      console.error("Failed to add gift from catalog:", error);
      toast({ description: "Couldn't add this gift — please try again." });
    } finally {
      setBusy(false);
    }
  };

  const approve = async (confirmed = false) => {
    if (activeCount < MIN_ACTIVE_APPROVE) {
      toast({ description: `A list needs at least ${MIN_ACTIVE_APPROVE} active gifts before it can be approved.` });
      return;
    }
    // A thin bench of backups is allowed, but Gem confirms it deliberately.
    if (!confirmed && standbyItems.length < MIN_STANDBY_SILENT) {
      setConfirmingApprove(true);
      return;
    }
    setConfirmingApprove(false);
    setBusy(true);
    try {
      await base44.entities.GiftList.update(list.id, {
        status: "approved",
        approved_at: new Date().toISOString(),
        visible_to_subscriber: true,
      });
      if (list.supersedesListId) {
        await base44.entities.GiftList.update(list.supersedesListId, {
          visible_to_subscriber: false,
        });
      }
      // The notification email must never block approval — if it fails, the list is
      // still approved and visible to the subscriber. Isolate it so a send error
      // can't abort the approval flow.
      try {
        // Get subscriber and recipient details for email
        const response = await fetch('http://localhost:3001/api/email/approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: subscriber?.email,
            name: subscriber?.name || subscriber?.firstName,
            recipientName: recipient?.name,
            giftCount: activeCount,
            subscriberId: subscriber?.id,
            recipientId: recipient?.id,
            giftListId: list?.id,
          }),
        });
        
        const result = await response.json();
        if (!result.success) {
          console.warn('Approval email failed:', result.error);
          toast({ description: "List approved, but the email didn't send. It's safe to approve again later to re-send." });
        }
      } catch (error) {
        console.warn('Approval email error:', error);
        // Email failed to send; approval itself succeeded.
      }
      await refresh();
      toast({ description: `${recipient?.name || "List"} approved.` });
      onBack();
    } catch (error) {
      console.error("Failed to approve list:", error);
      toast({ description: "Couldn't approve this list — please try again." });
    } finally {
      setBusy(false);
    }
  };

  // For lists generated before a rules fix (budget/copy) landed — regenerate from
  // scratch with the current rules rather than relying on stale saved items.
  const regenerate = async () => {
    setRegenerating(true);
    try {
      // Generate FIRST — the original list stays in pending_approval until a usable
      // replacement exists, so a failed regeneration can no longer destroy the queue
      // entry. supersedes_list_id lets approve() hide the old list once the new one
      // is approved.
      const res = await base44.functions.invoke("generateGiftList", {
        recipient_id: list.recipientId,
        list_type: list.listType,
        supersedes_list_id: list.id,
      });
      const data = res?.data || {};

      // generateGiftList re-derives the recipient profile and rewrites derived_profile_hash
      // on every run (success or not), so the cached Recipient is stale the moment
      // this returns and the stale-profile badge would keep rendering. Invalidated
      // here rather than inside refresh(): promote/demote/remove share that helper
      // and never touch the Recipient, so they must not pay for a full refetch.
      await queryClient.invalidateQueries({ queryKey: ["recipients-all"] });

      // Handle quality check failures with detailed messages
      if (data.status === "quality_check_failed") {
        const reasons = data.failedReasons?.join(", ") || "Quality standards not met";
        const giftCount = data.giftsGenerated || 0;
        await refresh();
        toast({ 
          title: "Quality Check Failed",
          description: `Generated ${giftCount} gifts but rejected: ${reasons}. Try adjusting recipient interests or add more products.`,
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      if (data.status === "insufficient_products") {
        const candidatesFound = data.candidatesFound || 0;
        await refresh();
        toast({ 
          title: "Insufficient Products",
          description: `Only found ${candidatesFound} matching products (need at least 3). Add more products with matching interests to the catalogue.`,
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      if (data.error || data.status !== "pending_approval" || !data.giftListId) {
        await refresh();
        toast({ 
          title: "Regeneration Failed",
          description: data.message || data.error || "Regeneration didn't produce a usable list — please review manually.",
          variant: "destructive",
        });
        onBack();
        return;
      }

      // Only now retire the list being replaced.
      await base44.entities.GiftList.update(list.id, { status: "rejected" });
      await refresh();

      toast({ description: `${recipient?.name || "List"} regenerated with the latest rules.` });
      // Go straight to the freshly generated list instead of dropping back to the
      // full queue — stay in context on the same recipient.
      if (onRegenerated) {
        onRegenerated(data.giftListId);
      } else {
        onBack();
      }
    } catch {
      toast({ 
        title: "Error",
        description: "Couldn't regenerate this list — please try again.",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const reject = async () => {
    if (!rejectReason) {
      toast({ description: "Choose why this list is unsuitable first." });
      return;
    }
    setBusy(true);
    try {
      // Structured reason on the record itself — ai_prompt_used is left untouched.
      await base44.entities.GiftList.update(list.id, {
        status: "rejected",
        rejection_reason: rejectReason,
        rejection_note: rejectNote.trim() || undefined,
      });
      await refresh();
      toast({ description: `${recipient?.name || "List"} rejected.` });
      onBack();
    } catch (error) {
      console.error("Failed to reject list:", error);
      toast({ description: "Couldn't reject this list — please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 font-body text-sm text-brand-teal font-medium mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </button>

      {/* Recipient profile summary */}
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h1 className="font-display text-2xl text-brand-dark">{recipient?.name}</h1>
            <p className="font-body text-sm text-brand-dark/50">
              For {subscriber?.name} · {LIST_LABEL[list.listType]}
            </p>
          </div>
          <p className="font-body text-sm text-brand-dark/60">
            Birthday {formatShortDate(list.birthdayDate)}
          </p>
        </div>
        {profileEditedAfterGeneration && (
          <p className="font-body text-xs font-medium text-amber-700 bg-amber-100 rounded-lg px-3 py-2 mb-3">
            {recipient?.name || "This recipient"}'s profile was updated after these gifts were generated — Regenerate will use the latest details.
          </p>
        )}
        {supersededList?.refreshReason && (
          <p className="font-body text-xs text-brand-dark/60 bg-brand-gold-soft/30 rounded-lg px-3 py-2 mb-3">
            Subscriber's refresh note: "{supersededList.refreshReason}"
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ProfileRow label="Relationship" value={recipient?.relationship} />
          <ProfileRow label="Gender" value={GENDER_LABEL[recipient?.gender] || recipient?.gender} />
          <ProfileRow label="Age band" value={AGE_BAND_LABEL[recipient?.ageBand] || recipient?.ageBand} />
          <ProfileRow
            label="Budget"
            value={
              recipient?.budgetMin != null || recipient?.budgetMax != null
                ? `${gbp(recipient?.budgetMin)} – ${gbp(recipient?.budgetMax)}`
                : null
            }
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <ProfileRow label="Interests" value={arr(recipient?.interests)} />
          <ProfileRow label="Personality" value={arr(recipient?.personality)} />
          <ProfileRow label="Gift types they love" value={arr(recipient?.giftTypes)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <ProfileRow label="Who they are" value={recipient?.whoTheyAre} />
          <ProfileRow label="Hobbies & interests" value={recipient?.hobbiesAndInterests} />
          <ProfileRow label="Things you know" value={recipient?.thingsYouKnow} />
          <ProfileRow label="Milestones" value={recipient?.milestones} />
          <ProfileRow label="Gifts to avoid" value={recipient?.avoidNotes} />
          <ProfileRow label="Notes" value={recipient?.notes} />
        </div>
      </div>

      {removeTarget && (
        <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mb-5 border border-brand-gold/40">
          <h2 className="font-display text-lg text-brand-dark">Why remove {removeTarget.title}?</h2>
          <p className="font-body text-xs text-brand-dark/50 mt-1 mb-3">Gem's answer will be stored so future recommendation rules can be measured and improved.</p>
          <select
            value={removalReason}
            onChange={(event) => setRemovalReason(event.target.value)}
            className="w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2.5 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
          >
            <option value="">Choose a reason</option>
            {REMOVAL_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <textarea
            value={removalNote}
            onChange={(event) => setRemovalNote(event.target.value)}
            placeholder="Optional detail"
            className="w-full min-h-20 mt-3 rounded-xl border border-brand-teal/20 bg-white px-3 py-2 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button disabled={busy || !removalReason} onClick={removeItem} className="bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-2.5 min-h-[44px] disabled:opacity-50">Remove gift</button>
            <button disabled={busy} onClick={() => { setRemoveTarget(null); setRemovalReason(""); setRemovalNote(""); }} className="border border-brand-teal/30 text-brand-teal font-body font-medium rounded-xl py-2.5 min-h-[44px]">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-brand-dark/40 font-body py-10">Loading gifts…</p>
      ) : (
        <>
          {/* Top 5 Selected */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-brand-dark">Top 5 Selected</h2>
            <span className="font-body text-xs text-brand-dark/45">{activeCount} of {MAX_ACTIVE}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {activeItems.map((item) => (
              <GiftCard
                key={item.id}
                item={item}
                action={
                  <>
                    <button
                      disabled={busy}
                      onClick={() => demote(item)}
                      className="inline-flex items-center gap-1 font-body text-xs text-brand-teal font-medium border border-brand-gold/60 rounded-lg px-2.5 py-1.5 hover:bg-brand-gold-soft/20 disabled:opacity-50"
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" /> Move to backup
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setRemoveTarget(item)}
                      className="inline-flex items-center gap-1 font-body text-xs text-brand-teal font-medium border border-brand-teal/30 rounded-lg px-2.5 py-1.5 hover:bg-brand-teal/5 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </>
                }
              />
            ))}
            {activeItems.length === 0 && (
              <p className="font-body text-sm text-brand-dark/45 col-span-2 py-4">
                No gifts selected yet — promote one from Backup Ideas below.
              </p>
            )}
          </div>

          {/* Backup Ideas */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-brand-dark">Backup Ideas</h2>
            <span className="font-body text-xs text-brand-dark/45">{standbyItems.length} available</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {standbyItems.map((item) => (
              <GiftCard
                key={item.id}
                item={item}
                action={
                  <>
                    <button
                      disabled={busy || activeCount >= MAX_ACTIVE}
                      onClick={() => promote(item)}
                      title={activeCount >= MAX_ACTIVE ? "Top 5 is full — move one to backups first" : undefined}
                      className="inline-flex items-center gap-1 font-body text-xs text-brand-teal font-medium border border-brand-gold/60 rounded-lg px-2.5 py-1.5 hover:bg-brand-gold-soft/20 disabled:opacity-40"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" /> Promote to Top 5
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setRemoveTarget(item)}
                      className="inline-flex items-center gap-1 font-body text-xs text-brand-teal font-medium border border-brand-teal/30 rounded-lg px-2.5 py-1.5 hover:bg-brand-teal/5 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </>
                }
              />
            ))}
            {standbyItems.length === 0 && (
              <p className="font-body text-sm text-brand-dark/45 col-span-2 py-4">
                No backup ideas left for this list.
              </p>
            )}
          </div>

          {/* Swap gift: catalogue picker (primary) + manual entry (secondary) */}
          <div className="mt-5">
            {addMode === "catalog" && (
              <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 border border-brand-gold/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg text-brand-dark">Swap from catalogue</h3>
                  <button onClick={() => setAddMode(null)} disabled={busy} className="text-brand-dark/40 hover:text-brand-dark disabled:opacity-50">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <CatalogSwapPicker recipient={recipient} onAdd={addFromCatalog} busy={busy} />
                <button
                  onClick={() => setAddMode("manual")}
                  disabled={busy}
                  className="mt-4 font-body text-xs text-brand-teal font-medium underline disabled:opacity-50"
                >
                  Can't find it? Add a gift manually instead
                </button>
              </div>
            )}
            {addMode === "manual" && (
              <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 border border-brand-gold/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg text-brand-dark">Add a gift manually</h3>
                  <button onClick={() => setAddMode(null)} disabled={busy} className="text-brand-dark/40 hover:text-brand-dark disabled:opacity-50">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <ManualGiftForm onSubmit={addManual} onCancel={() => setAddMode(null)} busy={busy} />
              </div>
            )}
            {addMode === null && (
              <button
                onClick={() => setAddMode("catalog")}
                className="inline-flex items-center gap-1.5 font-body text-sm text-brand-teal font-medium border border-brand-gold/60 rounded-xl px-4 py-2.5 min-h-[44px] hover:bg-brand-gold-soft/20"
              >
                <Plus className="w-4 h-4" /> Swap in a gift
              </button>
            )}
          </div>
        </>
      )}

      {/* List actions */}
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 mt-8">
        <p className="font-body text-sm text-brand-dark/60 mb-3">
          {activeCount} active {activeCount === 1 ? "gift" : "gifts"} in this list.
        </p>

        <button
          disabled={busy || regenerating}
          onClick={regenerate}
          className="w-full border border-brand-gold/60 text-brand-teal font-body text-sm font-medium rounded-xl py-2.5 min-h-[44px] mb-3 hover:bg-brand-gold-soft/20 disabled:opacity-50"
        >
          {regenerating ? "Regenerating…" : "Regenerate with latest rules"}
        </button>

        {rejecting ? (
          <div className="space-y-3">
            <select
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2.5 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
            >
              <option value="">Choose a reason</option>
              {REMOVAL_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Add a rejection note (optional)…"
              className="w-full min-h-24 rounded-xl border border-brand-teal/20 bg-white px-3 py-2 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={busy || !rejectReason}
                onClick={reject}
                className="bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-50"
              >
                Confirm Rejection
              </button>
              <button
                disabled={busy}
                onClick={() => setRejecting(false)}
                className="border border-brand-teal/30 text-brand-teal font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : confirmingApprove ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-brand-dark/60">
              Fewer than five backup ideas remain on this list. Approve it anyway?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={busy}
                onClick={() => approve(true)}
                className="bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-50"
              >
                Approve anyway
              </button>
              <button
                disabled={busy}
                onClick={() => setConfirmingApprove(false)}
                className="border border-brand-teal/30 text-brand-teal font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy || activeCount < MIN_ACTIVE_APPROVE}
              onClick={() => approve()}
              className="bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="border border-brand-teal/30 text-brand-teal font-body font-medium rounded-xl py-3 min-h-[44px] hover:bg-brand-teal/5 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
        {activeCount < MIN_ACTIVE_APPROVE && !rejecting && (
          <p className="font-body text-xs text-brand-dark/50 mt-2">
            A list needs at least {MIN_ACTIVE_APPROVE} active gifts before it can be approved.
          </p>
        )}
      </div>
    </div>
  );
}