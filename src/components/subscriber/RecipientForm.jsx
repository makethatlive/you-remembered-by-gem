import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckboxGroup } from "@/components/onboarding/Fields";
import StructuredInterestsField from "@/components/onboarding/StructuredInterestsField";
import RelationshipField from "@/components/shared/RelationshipField";
import OccasionsField from "@/components/onboarding/OccasionsField";
import {
  AGE_CATEGORIES, KIDS_AGE_RANGES, ADULT_AGE_RANGES, AGES_UNDER_12, ageBandFromRange, ageBandFromChildBracket,
  CHILD_INTERESTS_HELPER, PERSONALITY_OPTIONS, GIFT_TYPE_OPTIONS, PERSONAL_OCCASIONS,
} from "@/components/onboarding/options";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

// Convert database enum values to display labels
function normalizeGenderForForm(dbValue) {
  const mapping = {
    MALE: "Male",
    FEMALE: "Female",
    NON_BINARY: "Non-binary",
    PREFER_NOT_TO_SAY: "Prefer not to say",
  };
  return mapping[dbValue] || dbValue;
}

// Convert display labels to database enum values
function normalizeGenderForDB(formValue) {
  const mapping = {
    "Male": "MALE",
    "Female": "FEMALE",
    "Non-binary": "NON_BINARY",
    "Prefer not to say": "PREFER_NOT_TO_SAY",
  };
  return mapping[formValue] || formValue;
}

// Fields whose change alters what generateGiftList produces. Mirrors profileHash
// (generateGiftList/entry.ts:412-426) plus budget_min/budget_max, which drive the
// hard budget filter but sit outside the hash. name and occasion dates/labels are
// deliberately absent — they never change matching. Keep in sync with R6 and with
// ApprovalDetail's computeProfileHash twin (W7.5).
const GEN_RELEVANT_FIELDS = [
  ["relationship", "relationship"],
  ["gender", "gender"],
  ["age_band", "age"],
  ["interests", "interests"],
  ["personality", "personality"],
  ["gift_types", "gift types"],
  ["avoid_notes", "gifts to avoid"],
  ["who_they_are", "who they are"],
  ["hobbies_and_interests", "hobbies"],
  ["things_you_know", "things you know"],
  ["milestones", "milestones"],
  ["notes", "notes"],
  ["budget_min", "budget"],
  ["budget_max", "budget"],
];

// Order-insensitive for arrays; folds null/undefined/"" AND empty arrays into the same
// token, so a stored recipient lacking an array field diffs clean against the form's
// [] defaults (no phantom diffs, no false refresh offers).
const normForDiff = (v) => Array.isArray(v) ? (v.length ? JSON.stringify([...v].sort()) : JSON.stringify("")) : JSON.stringify(v ?? "");

function generationRelevantChanges(before, payload) {
  const labels = [];
  for (const [key, label] of GEN_RELEVANT_FIELDS) {
    if (normForDiff(before?.[key]) !== normForDiff(payload[key]) && !labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

// Reconstruct the occasions[] editor state from a stored recipient: prefer the
// occasions array; fall back to the legacy single occasion fields so existing
// records still edit correctly.
function occasionsFromRecipient(recipient) {
  if (Array.isArray(recipient?.occasions) && recipient.occasions.length) {
    return recipient.occasions.map((o) => ({
      type: o.type || "Other",
      custom_label: o.customLabel || o.custom_label || "",
      day: o.day ? String(o.day) : "",
      month: o.month ? String(o.month) : "",
      budget_min: o.budgetMin ?? o.budget_min ?? "",
      budget_max: o.budgetMax ?? o.budget_max ?? "",
    }));
  }
  if (recipient?.occasion) {
    return [{
      type: recipient.occasion,
      custom_label: "",
      day: recipient.occasionDay ? String(recipient.occasionDay) : (recipient.occasion_day ? String(recipient.occasion_day) : ""),
      month: recipient.occasionMonth ? String(recipient.occasionMonth) : (recipient.occasion_month ? String(recipient.occasion_month) : ""),
      budget_min: recipient.budgetMin ?? recipient.budget_min ?? "",
      budget_max: recipient.budgetMax ?? recipient.budget_max ?? "",
    }];
  }
  return [];
}

export default function RecipientForm({ subscriber, recipient, onDone }) {
  const queryClient = useQueryClient();
  const isEdit = !!recipient?.id;
  
  console.log("🔍 RecipientForm: Full recipient object keys:", Object.keys(recipient || {}));
  console.log("🔍 RecipientForm: recipient data received:", recipient);
  console.log("🔍 interests_detail from DB:", recipient?.interests_detail);
  console.log("🔍 interestsDetail from DB (camelCase):", recipient?.interestsDetail);
  console.log("🔍 personality_other from DB:", recipient?.personality_other);
  console.log("🔍 personalityOther from DB (camelCase):", recipient?.personalityOther);
  console.log("🔍 gift_types_other from DB:", recipient?.gift_types_other);
  console.log("🔍 giftTypesOther from DB (camelCase):", recipient?.giftTypesOther);
  
  // Reconstruct interests from stored data (try both camelCase and snake_case)
  const storedInterests = recipient?.interestsDetail || recipient?.interests_detail || { 
    interests: recipient?.interests || [], 
    followUps: {},
    otherText: ""
  };
  
  console.log("🔍 storedInterests for form:", storedInterests);
  
  const [form, setForm] = useState({
    name: recipient?.name || "",
    relationship: recipient?.relationship || "",
    occasions: occasionsFromRecipient(recipient),
    age_category: recipient?.ageRange ? (["1-2", "3-4", "5-6", "7-8", "9-11", "12-17"].includes(recipient.ageRange) ? "Kids" : "All adults") : "",
    age_range: recipient?.ageRange || "",
    gender: normalizeGenderForForm(recipient?.gender) || "",
    age_band: recipient?.ageBand || "",
    interests: storedInterests,
    personality: recipient?.personality || [],
    personality_other: recipient?.personalityOther || recipient?.personality_other || "",
    gift_types: recipient?.giftTypes || [],
    gift_types_other: recipient?.giftTypesOther || recipient?.gift_types_other || "",
    avoid_notes: recipient?.avoidNotes || "",
    who_they_are: recipient?.whoTheyAre || "",
    hobbies_and_interests: recipient?.hobbiesAndInterests || "",
    things_you_know: recipient?.thingsYouKnow || "",
    notes: recipient?.notes || "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isKids = form.age_category === "Kids";
  const isUnder12 = isKids && AGES_UNDER_12.includes(form.age_range);
  const ageRangeOptions = isKids ? KIDS_AGE_RANGES : ADULT_AGE_RANGES;

  // Post-save regeneration offer state:
  // null = no offer; { kind: "offer", labels, listId } = ask; { kind: "info", text } = one-button panel.
  const [postSave, setPostSave] = useState(null);
  const [requestingRefresh, setRequestingRefresh] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? base44.entities.Recipient.update(recipient.id, payload)
        : base44.entities.Recipient.create(payload),
    onSuccess: async (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: ["recipients", subscriber?.id] });
      if (!isEdit) return onDone();
      const labels = generationRelevantChanges(recipient, payload);
      if (labels.length === 0) return onDone();
      // Find the newest list this subscriber can refresh. Read is RLS-scoped to the
      // owner (GiftList.jsonc read rule); visibility filtered client-side exactly like
      // GiftListsTab.jsx:38. Legacy lists missing subscriber_user_id are unreadable
      // here — absence is normal and falls through to the passive message.
      let refreshable = null;
      try {
        const lists = await base44.entities.GiftList.filter({ recipient_id: recipient.id });
        refreshable = lists
          .filter((l) => l.visibleToSubscriber === true)
          .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))[0] || null;
      } catch {
        refreshable = null;
      }
      if (refreshable) {
        setPostSave({ kind: "offer", labels, listId: refreshable.id });
      } else {
        setPostSave({ kind: "info", text: "Saved. Your updates will shape the next gift list Gem curates." });
      }
    },
  });

  const requestRefreshAfterEdit = async () => {
    if (!postSave || postSave.kind !== "offer") return;
    setRequestingRefresh(true);
    try {
      const result = await base44.functions.invoke("requestGiftRefresh", {
        gift_list_id: postSave.listId,
        refresh_reason: `Profile updated: ${postSave.labels.join(", ")}`.slice(0, 300),
      });
      const data = result?.data || {};
      if (data.error) throw new Error(data.error);
      setPostSave({
        kind: "info",
        text: data.status === "already_requested"
          ? "Fresh ideas are already on their way — Gem will see your updates when she reviews them."
          : "Your updates are with Gem. The list will refresh once the new ideas have been checked.",
      });
    } catch (error) {
      // invoke rejects on any non-2xx; the real body is on error.response.data.
      setPostSave({
        kind: "info",
        text: error?.response?.data?.error || "Saved — but we couldn't request fresh ideas just now. You can refresh from the gift list instead.",
      });
    } finally {
      setRequestingRefresh(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = "Name is required";
    if (!form.relationship.trim()) er.relationship = "Relationship is required";
    if (!form.occasions.length) {
      er.occasions = "Please select at least one occasion";
    } else {
      // Validate each occasion
      const hasInvalidOccasion = form.occasions.some((o) => {
        const isPersonal = PERSONAL_OCCASIONS.includes(o.type);
        const missingDate = isPersonal && (!o.day || !o.month);
        const missingBudget = o.budget_min === "" || o.budget_max === "";
        const missingCustomLabel = o.type === "Other" && !o.custom_label.trim();
        return missingDate || missingBudget || missingCustomLabel;
      });
      
      if (hasInvalidOccasion) {
        er.occasions = "Please complete all required fields for each occasion";
      } else {
        // Validate budget values
        const hasInvalidBudget = form.occasions.some((o) => {
          const min = Number(o.budget_min);
          const max = Number(o.budget_max);
          return min < 0 || max < 0 || min > max;
        });
        
        if (hasInvalidBudget) {
          er.occasions = "Budget minimum must be ≤ maximum, and both must be positive numbers";
        }
      }
    }
    if (!form.gender) er.gender = "Gender is required";
    if (!form.age_category) er.age_category = "Please select if this person is a child or adult";
    if (!form.age_range) er.age_range = "Age range is required";
    setErrors(er);
    if (Object.keys(er).length) return;

    const pad = (n) => String(n).padStart(2, "0");
    const primary = form.occasions.find((o) => o.type === "Birthday") || form.occasions[0];
    const primaryLabel = primary.type === "Other" ? (primary.custom_label.trim() || "Other") : primary.type;
    
    // For non-personal occasions (Christmas, etc), use arbitrary date for legacy fields
    const isPersonalPrimary = PERSONAL_OCCASIONS.includes(primary.type);
    const day = isPersonalPrimary ? Number(primary.day) : 1;
    const month = isPersonalPrimary ? Number(primary.month) : 12;

    const { occasions, age_category, age_range, ...rest } = form;
    
    const payload = {
      ...rest,
      gender: normalizeGenderForDB(form.gender),
      age_range,
      age_band: isUnder12 ? ageBandFromChildBracket(age_range) : ageBandFromRange(age_range),
      occasion: primaryLabel,
      occasion_day: day,
      occasion_month: month,
      birthday: isPersonalPrimary ? `--${pad(month)}-${pad(day)}` : undefined,
      occasions: occasions.map((o) => {
        const isPersonal = PERSONAL_OCCASIONS.includes(o.type);
        return {
          type: o.type === "Other" ? (o.custom_label.trim() || "Other") : o.type,
          custom_label: o.type === "Other" ? o.custom_label.trim() : undefined,
          day: isPersonal ? Number(o.day) : undefined,
          month: isPersonal ? Number(o.month) : undefined,
          budget_min: Number(o.budget_min),
          budget_max: Number(o.budget_max),
        };
      }),
      budget_min: Number(primary.budget_min),
      budget_max: Number(primary.budget_max),
      interests: form.interests.interests || [],
      interests_detail: form.interests,
      personality: form.personality,
      personality_other: form.personality_other?.trim() || undefined,
      gift_types: form.gift_types,
      gift_types_other: form.gift_types_other?.trim() || undefined,
      subscriber_id: subscriber.id,
    };
    
    console.log("RecipientForm: Submitting payload:", JSON.stringify(payload, null, 2));
    mutation.mutate(payload);
  };

  return (
    <div className="max-w-6xl mx-auto px-8 sm:px-12 lg:px-16 pt-5">
      <button
        onClick={onDone}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="font-display text-2xl text-brand-dark mb-1">
        {isEdit ? `Edit ${recipient.name}` : "Add Someone Special"}
      </h1>
      <p className="font-body text-sm text-brand-dark/55 mb-6">
        The more you tell us, the better the gift. Tell us everything.
      </p>

      <form onSubmit={submit} className="space-y-5 pb-4">
        <Field label="Name" error={errors.name}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-12" placeholder="e.g. Sarah" />
        </Field>
        <Field label="Relationship" error={errors.relationship}>
          <RelationshipField value={form.relationship} onChange={(v) => set("relationship", v)} />
        </Field>

        <Field label="Occasions to remember" helper="Select all that apply for this person — you can pick more than one, and each will get its own date and budget below. The occasions shown depend on your relationship to this person." error={errors.occasions}>
          <OccasionsField relationship={form.relationship} value={form.occasions} onChange={(v) => set("occasions", v)} />
        </Field>

        <div className="pt-4 pb-2 border-t border-brand-dark/10">
          <h2 className="font-display text-xl text-brand-dark mb-1">Tell Me About Them</h2>
          <p className="font-body text-xs text-brand-dark/60">
            We recognise that completing this in full takes a little time — and that's completely fine. Fill in what you can now, and I'll send you a reminder email 6 weeks before their occasion with another opportunity to add more detail. Even the basics give me a strong starting point.
          </p>
        </div>

        <Field label="Gender" error={errors.gender}>
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Approximate age" error={errors.age_category}>
          <p className="font-body text-sm text-brand-dark/70 mb-3">Is this person a child, or an adult?</p>
          <div className="flex gap-4">
            {AGE_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="age_category"
                  value={cat}
                  checked={form.age_category === cat}
                  onChange={(e) => {
                    set("age_category", e.target.value);
                    set("age_range", ""); // Reset age range when category changes
                  }}
                  className="w-4 h-4 accent-brand-teal"
                />
                <span className="font-body text-sm text-brand-dark">{cat}</span>
              </label>
            ))}
          </div>
        </Field>

        {form.age_category && (
          <Field label="Age range" error={errors.age_range}>
            <Select value={form.age_range} onValueChange={(v) => set("age_range", v)}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Please choose" />
              </SelectTrigger>
              <SelectContent>
                {ageRangeOptions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {isUnder12 ? (
          <>
            <Field label="What are they into?" helper={CHILD_INTERESTS_HELPER}>
              <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} placeholder="e.g. dinosaurs, princesses, building things, animals..." />
            </Field>
            <Field label="Gifts or categories to avoid" optional>
              <Textarea value={form.avoid_notes} onChange={(e) => set("avoid_notes", e.target.value)} rows={2} placeholder="e.g. they're vegan, they don't drink, they hate clutter" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Their interests" optional helper="Select all that apply. Categories with a ▸ will reveal a short follow-up question to help narrow down the best gift ideas.">
              <StructuredInterestsField value={form.interests} onChange={(v) => set("interests", v)} />
            </Field>

            <Field label="Their personality" optional helper="Select up to 3. Only tag a trait if it's unmistakably true of the person.">
              <CheckboxGroup 
                options={PERSONALITY_OPTIONS} 
                value={form.personality} 
                onChange={(v) => set("personality", v)} 
                max={3}
                otherText={form.personality_other}
                onOtherTextChange={(v) => set("personality_other", v)}
              />
            </Field>

            <Field label="What kind of gifts do they tend to love?" optional helper="Select all that apply">
              <CheckboxGroup 
                options={GIFT_TYPE_OPTIONS} 
                value={form.gift_types} 
                onChange={(v) => set("gift_types", v)}
                otherText={form.gift_types_other}
                onOtherTextChange={(v) => set("gift_types_other", v)}
              />
            </Field>

            <Field label="Gifts or categories to avoid" optional>
              <Textarea value={form.avoid_notes} onChange={(e) => set("avoid_notes", e.target.value)} rows={2} placeholder="e.g. they're vegan, they don't drink, they hate clutter" />
            </Field>

            <Field label="Who they are" optional helper="Tell me about them as a person. What are they like?">
              <Textarea value={form.who_they_are} onChange={(e) => set("who_they_are", e.target.value)} rows={4} placeholder="Their personality, what makes them special..." />
            </Field>

            <Field label="Hobbies and interests" optional helper="What do they love doing? Any passions, sports, collections?">
              <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} placeholder="Free-form detail about what they're passionate about..." />
            </Field>

            <Field label="Anything else?" optional helper="This is your chance to give me real colour — a recent life change, something they've mentioned wanting, a hobby they've just taken up, their personality and taste level, what's worked brilliantly in the past or fallen completely flat. Small details go a long way — a favourite colour, a football team they support, the style of jewellery they wear. Also let me know if there's a significant milestone coming up — a big birthday, retirement, having a baby, buying a house — anything that might call for something extra special. The more you share, the more personal my suggestions will be.">
              <Textarea value={form.things_you_know} onChange={(e) => set("things_you_know", e.target.value)} rows={6} placeholder="Favourite brands, colours, things they've mentioned wanting, upcoming milestones..." />
            </Field>
          </>
        )}

        <Field label="Notes" optional helper="Anything else Gem should know.">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </Field>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:bg-brand-teal-dark disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Add Recipient"}
        </button>
      </form>

      <AlertDialog
        open={!!postSave}
        onOpenChange={(open) => { if (!open && !requestingRefresh) { setPostSave(null); onDone(); } }}
      >
        <AlertDialogContent>
          {postSave?.kind === "offer" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Refresh {recipient?.name}'s suggestions?</AlertDialogTitle>
                <AlertDialogDescription>
                  You've updated {postSave.labels.join(", ")}. Want Gem to curate fresh suggestions with the new details? The current list stays until the new one is ready.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={requestingRefresh}>Not now</AlertDialogCancel>
                <AlertDialogAction
                  disabled={requestingRefresh}
                  onClick={(e) => { e.preventDefault(); requestRefreshAfterEdit(); }}
                >
                  {requestingRefresh ? "Requesting…" : "Yes, refresh suggestions"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Profile saved</AlertDialogTitle>
                <AlertDialogDescription>{postSave?.text}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => { setPostSave(null); onDone(); }}>Done</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, error, helper, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-sm text-brand-dark/80">{label}</Label>
      {helper && <p className="font-body text-xs text-brand-dark/45 whitespace-pre-line">{helper}</p>}
      {children}
      {error && <p className="text-xs text-red-500 font-body">{error}</p>}
    </div>
  );
}