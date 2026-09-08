import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  STANDARD_OCCASIONS, RELATIONSHIP_OCCASION_DEFAULTS, ADDITIONAL_OCCASION_OPTIONS, MONTHS,
} from "./options";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Multi-occasion selector: standard + relationship-specific occasions always shown,
// more available under "+ Additional occasions". Each ticked occasion gets its own
// date + budget row. `value` is an array of { type, custom_label, day, month, budget_min, budget_max }.
export default function OccasionsField({ relationship, value = [], onChange, error }) {
  const [showMore, setShowMore] = useState(false);

  const relExtras = RELATIONSHIP_OCCASION_DEFAULTS[relationship] || [];
  const primary = [...STANDARD_OCCASIONS, ...relExtras];
  const additional = ADDITIONAL_OCCASION_OPTIONS.filter((o) => !primary.includes(o));

  const findIndex = (type) => value.findIndex((o) => o.type === type);
  const isChecked = (type) => findIndex(type) !== -1;

  const toggle = (type) => {
    const idx = findIndex(type);
    if (idx !== -1) {
      onChange(value.filter((_, i) => i !== idx));
    } else {
      onChange([...value, { type, custom_label: "", day: "", month: "", budget_min: "", budget_max: "" }]);
    }
  };

  const updateOccasion = (type, patch) => {
    onChange(value.map((o) => (o.type === type ? { ...o, ...patch } : o)));
  };

  const renderCheckbox = (label) => (
    <label key={label} className="flex items-center gap-2.5 font-body text-sm text-brand-dark/80 cursor-pointer">
      <Checkbox
        checked={isChecked(label)}
        onCheckedChange={() => toggle(label)}
        className="border-brand-teal data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {primary.map(renderCheckbox)}
      </div>

      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="font-body text-sm text-brand-teal font-medium underline"
      >
        {showMore ? "Hide additional occasions" : "+ Additional occasions"}
      </button>

      {showMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-1">
          {additional.map(renderCheckbox)}
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-body">{error}</p>}

      {value.length > 0 && (
        <div className="space-y-3 pt-1">
          {value.map((occ) => (
            <div key={occ.type} className="bg-brand-cream-card rounded-xl p-4 space-y-3 border border-brand-gold/20">
              <p className="font-body text-sm font-semibold text-brand-dark">
                {occ.type === "Other" ? "Other occasion" : occ.type}
              </p>
              {occ.type === "Other" && (
                <Input
                  value={occ.custom_label}
                  onChange={(e) => updateOccasion(occ.type, { custom_label: e.target.value })}
                  className="h-11"
                  placeholder="Please specify the occasion"
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Select value={String(occ.day || "")} onValueChange={(v) => updateOccasion(occ.type, { day: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {DAYS.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(occ.month || "")} onValueChange={(v) => updateOccasion(occ.type, { month: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  value={occ.budget_min}
                  onChange={(e) => updateOccasion(occ.type, { budget_min: e.target.value })}
                  className="h-11"
                  placeholder="Budget min (£)"
                />
                <Input
                  type="number"
                  value={occ.budget_max}
                  onChange={(e) => updateOccasion(occ.type, { budget_max: e.target.value })}
                  className="h-11"
                  placeholder="Budget max (£)"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}