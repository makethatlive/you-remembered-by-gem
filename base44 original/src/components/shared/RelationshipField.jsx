import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RELATIONSHIP_OPTIONS } from "@/components/onboarding/options";

// Standard relationship selector used across all screens.
// When the stored value is not one of the preset options (or "Other" is chosen),
// a free-text input is shown and its value is what gets saved.
export default function RelationshipField({ value, onChange }) {
  const isPreset = RELATIONSHIP_OPTIONS.includes(value);
  // "Other" mode = explicitly chose Other, or a custom value was previously saved.
  const isOther = value === "Other" || (value && !isPreset);

  const selectValue = isPreset ? value : (value ? "Other" : "");

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === "Other" ? "Other" : v)}
      >
        <SelectTrigger className="h-12">
          <SelectValue placeholder="Select relationship" />
        </SelectTrigger>
        <SelectContent>
          {RELATIONSHIP_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOther && (
        <Input
          value={value === "Other" ? "" : value}
          onChange={(e) => onChange(e.target.value || "Other")}
          className="h-12"
          placeholder="Please specify the relationship"
        />
      )}
    </div>
  );
}