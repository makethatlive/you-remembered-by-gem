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
import RelationshipField from "@/components/shared/RelationshipField";
import OccasionsField from "@/components/onboarding/OccasionsField";
import {
  AGE_RANGES, CHILD_AGE_BRACKETS, CHILD_INTERESTS_HELPER, ageBandFromRange, ageBandFromChildBracket,
  INTEREST_OPTIONS, PERSONALITY_OPTIONS, GIFT_TYPE_OPTIONS,
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
  const [form, setForm] = useState({
    name: recipient?.name || "",
    relationship: recipient?.relationship || "",
    occasions: occasionsFromRecipient(recipient),
    age_range: recipient?.ageRange || "",
    child_age_bracket: recipient?.childAgeBracket || "",
    gender: normalizeGenderForForm(recipient?.gender) || "",
    age_band: recipient?.ageBand || "",
    interests: recipient?.interests || [],
    personality: recipient?.personality || [],
    gift_types: recipient?.giftTypes || [],
    avoid_notes: recipient?.avoidNotes || "",
    who_they_are: recipient?.whoTheyAre || "",
    hobbies_and_interests: recipient?.hobbiesAndInterests || "",
    things_you_know: recipient?.thingsYouKnow || "",
    milestones: recipient?.milestones || "",
    notes: recipient?.notes || "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isChild = form.age_range === "Under 11";

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
    } else if (form.occasions.some((o) =>
      !o.day || !o.month || o.budget_min === "" || o.budget_max === "" || (o.type === "Other" && !o.custom_label.trim())
    )) {
      er.occasions = "Please complete the date and budget for each selected occasion";
    }
    if (!form.gender) er.gender = "Gender is required";
    if (!form.age_range) er.age_range = "Age range is required";
    if (isChild && !form.child_age_bracket) er.child_age_bracket = "Please choose an age bracket";
    setErrors(er);
    if (Object.keys(er).length) return;

    const pad = (n) => String(n).padStart(2, "0");
    const primary = form.occasions.find((o) => o.type === "Birthday") || form.occasions[0];
    const primaryLabel = primary.type === "Other" ? (primary.custom_label.trim() || "Other") : primary.type;
    const day = Number(primary.day);
    const month = Number(primary.month);

    const { occasions, age_range, child_age_bracket, ...rest } = form;
    mutation.mutate({
      ...rest,
      gender: normalizeGenderForDB(form.gender),
      age_range,
      child_age_bracket: isChild ? child_age_bracket : undefined,
      age_band: isChild ? ageBandFromChildBracket(child_age_bracket) : ageBandFromRange(age_range),
      occasion: primaryLabel,
      occasion_day: day,
      occasion_month: month,
      birthday: `--${pad(month)}-${pad(day)}`,
      occasions: occasions.map((o) => ({
        type: o.type === "Other" ? (o.custom_label.trim() || "Other") : o.type,
        custom_label: o.type === "Other" ? o.custom_label.trim() : undefined,
        day: Number(o.day),
        month: Number(o.month),
        budget_min: Number(o.budget_min),
        budget_max: Number(o.budget_max),
      })),
      budget_min: Number(primary.budget_min),
      budget_max: Number(primary.budget_max),
      subscriber_id: subscriber.id,
    });
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

        <Field label="Occasions to remember" error={errors.occasions}>
          <OccasionsField relationship={form.relationship} value={form.occasions} onChange={(v) => set("occasions", v)} />
        </Field>

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

        <Field label="Approximate age range" error={errors.age_range}>
          <Select value={form.age_range} onValueChange={(v) => set("age_range", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select age range" />
            </SelectTrigger>
            <SelectContent>
              {AGE_RANGES.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {isChild ? (
          <>
            <Field label="Detailed age bracket" error={errors.child_age_bracket}>
              <Select value={form.child_age_bracket} onValueChange={(v) => set("child_age_bracket", v)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select age bracket" />
                </SelectTrigger>
                <SelectContent>
                  {CHILD_AGE_BRACKETS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="What are they into?" helper={CHILD_INTERESTS_HELPER}>
              <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} />
            </Field>
            <Field label="Gifts or categories to avoid" helper="Anything they wouldn't want?">
              <Textarea value={form.avoid_notes} onChange={(e) => set("avoid_notes", e.target.value)} rows={2} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Their interests">
              <CheckboxGroup options={INTEREST_OPTIONS} value={form.interests} onChange={(v) => set("interests", v)} />
            </Field>
            <Field label="Their personality" helper="Select up to 3.">
              <CheckboxGroup options={PERSONALITY_OPTIONS} value={form.personality} onChange={(v) => set("personality", v)} max={3} />
            </Field>
            <Field label="What kind of gifts do they love?">
              <CheckboxGroup options={GIFT_TYPE_OPTIONS} value={form.gift_types} onChange={(v) => set("gift_types", v)} />
            </Field>

            <Field label="Gifts or categories to avoid" helper="Anything they wouldn't want?">
              <Textarea value={form.avoid_notes} onChange={(e) => set("avoid_notes", e.target.value)} rows={2} />
            </Field>
            <Field label="Who they are" helper="Tell us about them as a person. What are they like?">
              <Textarea value={form.who_they_are} onChange={(e) => set("who_they_are", e.target.value)} rows={4} />
            </Field>
            <Field label="Hobbies and interests" helper="What do they love doing? Any passions, sports, collections?">
              <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} />
            </Field>
            <Field label="Things you know" helper="Anything else that would help us find the perfect gift — favourite brands, colours, things they've mentioned wanting?">
              <Textarea value={form.things_you_know} onChange={(e) => set("things_you_know", e.target.value)} rows={4} />
            </Field>
            <Field label="Any upcoming significant milestones?" helper="A big birthday, a new home, a wedding...">
              <Textarea value={form.milestones} onChange={(e) => set("milestones", e.target.value)} rows={2} />
            </Field>
          </>
        )}

        <Field label="Notes" helper="Anything else Gem should know.">
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