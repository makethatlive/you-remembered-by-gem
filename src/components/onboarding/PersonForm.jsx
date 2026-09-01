import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Field, CheckboxGroup } from "./Fields";
import OccasionsField from "./OccasionsField";
import {
  RELATIONSHIP_OPTIONS, AGE_RANGES, CHILD_AGE_BRACKETS, CHILD_INTERESTS_HELPER, GENDER_OPTIONS,
  INTEREST_OPTIONS, PERSONALITY_OPTIONS, GIFT_TYPE_OPTIONS,
} from "./options";

export const EMPTY_PERSON = {
  name: "",
  relationship: "",
  relationship_other: "",
  occasions: [],
  age_range: "",
  child_age_bracket: "",
  gender: "",
  interests: [],
  personality: [],
  gift_types: [],
  avoid_notes: "",
  who_they_are: "",
  hobbies_and_interests: "",
  things_you_know: "",
  milestones: "",
  notes: "",
};

export default function PersonForm({ index, total, saving, onSubmit }) {
  const [form, setForm] = useState(EMPTY_PERSON);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const relIsOther = form.relationship === "Other";
  const isChild = form.age_range === "Under 11";

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = "Their first name is required";
    if (!form.relationship) er.relationship = "Please choose a relationship";
    if (relIsOther && !form.relationship_other.trim()) er.relationship = "Please specify the relationship";
    if (!form.occasions.length) {
      er.occasions = "Please select at least one occasion";
    } else if (form.occasions.some((o) =>
      !o.day || !o.month || o.budget_min === "" || o.budget_max === "" || (o.type === "Other" && !o.custom_label.trim())
    )) {
      er.occasions = "Please complete the date and budget for each selected occasion";
    }
    if (!form.age_range) er.age_range = "Please choose an age range";
    if (isChild && !form.child_age_bracket) er.child_age_bracket = "Please choose an age bracket";
    setErrors(er);
    if (Object.keys(er).length) return;
    onSubmit(form);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-dark mb-1 leading-snug">
        {index === 0 ? "Now, someone special" : "Add another person"}
      </h1>
      <p className="font-body text-sm text-brand-dark/55 mb-6">
        Person {index + 1} of up to {total}. The more you share, the better the gift.
      </p>

      <form onSubmit={submit} className="space-y-6 pb-4">
        <Field label="Their first name" error={errors.name}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-12" placeholder="First name only" />
        </Field>

        <Field label="Their relationship to you" error={errors.relationship}>
          <Select value={form.relationship} onValueChange={(v) => set("relationship", v)}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Please choose" /></SelectTrigger>
            <SelectContent className="z-[9999]">
              {RELATIONSHIP_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          {relIsOther && (
            <Input value={form.relationship_other} onChange={(e) => set("relationship_other", e.target.value)} className="h-12 mt-2" placeholder="Please specify" />
          )}
        </Field>

        <Field label="Occasions to remember" error={errors.occasions}>
          <OccasionsField relationship={form.relationship} value={form.occasions} onChange={(v) => set("occasions", v)} />
        </Field>

        <Field label="Approximate age range" error={errors.age_range}>
          <Select value={form.age_range} onValueChange={(v) => set("age_range", v)}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Please choose" /></SelectTrigger>
            <SelectContent className="z-[9999]">
              {AGE_RANGES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Their gender" optional>
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
            <SelectContent className="z-[9999]">
              {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        {isChild ? (
          <>
            <Field label="Detailed age bracket" error={errors.child_age_bracket}>
              <Select value={form.child_age_bracket} onValueChange={(v) => set("child_age_bracket", v)}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Please choose" /></SelectTrigger>
                <SelectContent className="z-[9999]">
                  {CHILD_AGE_BRACKETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="What are they into?" optional helper={CHILD_INTERESTS_HELPER}>
              <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} />
            </Field>
            <Field label="Gifts or categories to avoid" optional>
              <Textarea value={form.avoid_notes} onChange={(e) => set("avoid_notes", e.target.value)} rows={2} placeholder="Anything they wouldn't want?" />
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

            <Field label="Gifts or categories to avoid" optional>
              <Textarea value={form.avoid_notes} onChange={(e) => set("avoid_notes", e.target.value)} rows={2} placeholder="Anything they wouldn't want?" />
            </Field>

            <Field label="Who they are" optional helper="Tell us about them as a person. What are they like?">
              <Textarea value={form.who_they_are} onChange={(e) => set("who_they_are", e.target.value)} rows={4} />
            </Field>

            <Field label="Hobbies and interests" optional helper="What do they love doing? Any passions, sports, collections?">
              <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} />
            </Field>

            <Field label="Tell me anything else that would help" optional>
              <Textarea value={form.things_you_know} onChange={(e) => set("things_you_know", e.target.value)} rows={4} placeholder="Favourite brands, colours, things they've mentioned wanting..." />
            </Field>

            <Field label="Any upcoming significant milestones?" optional>
              <Textarea value={form.milestones} onChange={(e) => set("milestones", e.target.value)} rows={2} placeholder="A big birthday, a new home, a wedding..." />
            </Field>
          </>
        )}

        <Field label="Notes" optional helper="Anything else Gem should know.">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-gold text-brand-dark font-body font-semibold rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save this person
        </button>
      </form>
    </div>
  );
}