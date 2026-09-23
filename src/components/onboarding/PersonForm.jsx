import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Field, CheckboxGroup } from "./Fields";
import OccasionsField from "./OccasionsField";
import StructuredInterestsField from "./StructuredInterestsField";
import {
  RELATIONSHIP_OPTIONS, AGE_CATEGORIES, KIDS_AGE_RANGES, ADULT_AGE_RANGES, 
  AGES_UNDER_12, GENDER_OPTIONS, CHILD_INTERESTS_HELPER,
  PERSONALITY_OPTIONS, GIFT_TYPE_OPTIONS, PERSONAL_OCCASIONS,
} from "./options";

export const EMPTY_PERSON = {
  name: "",
  relationship: "",
  relationship_other: "",
  occasions: [],
  age_category: "",
  age_range: "",
  child_age_bracket: "",
  gender: "",
  interests: { interests: [], followUps: {}, otherText: "" },
  personality: [],
  personality_other: "",
  gift_types: [],
  gift_types_other: "",
  avoid_notes: "",
  who_they_are: "",
  hobbies_and_interests: "",
  things_you_know: "",
  notes: "",
};

export default function PersonForm({ index, total, saving, onSubmit }) {
  const [form, setForm] = useState(EMPTY_PERSON);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const relIsOther = form.relationship === "Other";
  const isKids = form.age_category === "Kids";
  const isUnder12 = isKids && AGES_UNDER_12.includes(form.age_range);
  const ageRangeOptions = isKids ? KIDS_AGE_RANGES : ADULT_AGE_RANGES;

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = "Their first name is required";
    if (!form.relationship) er.relationship = "Please choose a relationship";
    if (relIsOther && !form.relationship_other.trim()) er.relationship = "Please specify the relationship";
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
    if (!form.age_category) er.age_category = "Please select if this person is a child or adult";
    if (!form.age_range) er.age_range = "Please choose an age range";
    setErrors(er);
    if (Object.keys(er).length) return;
    onSubmit(form);
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-dark mb-1 leading-snug">
        {index === 0 ? "About the Person You'd Like Me to Remember" : "Add another person"}
      </h1>
      <p className="font-body text-sm text-brand-dark/55 mb-6">
        Complete one section per person. You can add up to 10 people. Don't worry about completing everything now — fill in what you can and I'll check in six weeks before their occasion with another opportunity to add more detail.
      </p>
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

        <Field 
          label="Their occasion(s)" 
          helper="Select all that apply for this person — you can pick more than one, and each will get its own date and budget below. The occasions shown depend on your relationship to this person — for example, selecting 'Partner / spouse' will surface Valentine's Day and Anniversary; selecting 'Mother' will surface Mother's Day. Every relationship always includes Birthday, Christmas, and Other." 
          error={errors.occasions}
        >
          <OccasionsField relationship={form.relationship} value={form.occasions} onChange={(v) => set("occasions", v)} />
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
              <SelectTrigger className="h-12"><SelectValue placeholder="Please choose" /></SelectTrigger>
              <SelectContent className="z-[9999]">
                {ageRangeOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="pt-4 pb-2 border-t border-brand-dark/10">
          <h2 className="font-display text-xl text-brand-dark mb-1">Tell Me About Them</h2>
          <p className="font-body text-xs text-brand-dark/60">
            We recognise that completing this in full takes a little time — and that's completely fine. Fill in what you can now, and I'll send you a reminder email 6 weeks before their occasion with another opportunity to add more detail. Even the basics give me a strong starting point.
          </p>
        </div>

        <Field label="Their gender" optional>
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
            <SelectContent className="z-[9999]">
              {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        {isUnder12 ? (
          <Field label="Tell me anything about what they love" optional helper={CHILD_INTERESTS_HELPER}>
            <Textarea value={form.hobbies_and_interests} onChange={(e) => set("hobbies_and_interests", e.target.value)} rows={4} placeholder="e.g. dinosaurs, princesses, building things, animals..." />
          </Field>
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

            <Field 
              label="Are there any gifts or categories to avoid?" 
              optional 
              helper="e.g. they're vegan, they don't drink, they hate clutter, they have a specific allergy"
            >
              <Textarea 
                value={form.avoid_notes || ''} 
                onChange={(e) => set("avoid_notes", e.target.value)} 
                rows={2} 
                placeholder="Anything they wouldn't want or can't have?" 
              />
            </Field>

            <Field label="Anything else?" optional helper="This is your chance to give me real colour — a recent life change, something they've mentioned wanting, a hobby they've just taken up, their personality and taste level, what's worked brilliantly in the past or fallen completely flat. Small details go a long way — a favourite colour, a football team they support, the style of jewellery they wear. Also let me know if there's a significant milestone coming up — a big birthday, retirement, having a baby, buying a house — anything that might call for something extra special. The more you share, the more personal my suggestions will be.">
              <Textarea value={form.things_you_know} onChange={(e) => set("things_you_know", e.target.value)} rows={6} placeholder="Favourite brands, colours, things they've mentioned wanting, upcoming milestones..." />
            </Field>
          </>
        )}

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