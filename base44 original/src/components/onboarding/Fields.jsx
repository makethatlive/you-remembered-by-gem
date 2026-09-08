import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function Field({ label, error, helper, optional, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-sm text-brand-dark/80">
        {label}
        {optional && <span className="text-brand-dark/40 font-normal"> (optional)</span>}
      </Label>
      {helper && <p className="font-body text-xs text-brand-dark/45">{helper}</p>}
      {children}
      {error && <p className="text-xs text-red-500 font-body">{error}</p>}
    </div>
  );
}

// Multi-select checkbox grid. `max` (optional) caps how many can be ticked.
export function CheckboxGroup({ options, value = [], onChange, max }) {
  const toggle = (opt) => {
    const has = value.includes(opt);
    if (has) {
      onChange(value.filter((v) => v !== opt));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, opt]);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
      {options.map((opt) => {
        const checked = value.includes(opt);
        const disabled = !checked && max && value.length >= max;
        return (
          <label
            key={opt}
            className={`flex items-start gap-2.5 font-body text-sm ${
              disabled ? "text-brand-dark/30 cursor-not-allowed" : "text-brand-dark/80 cursor-pointer"
            }`}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={() => toggle(opt)}
              className="mt-0.5 border-brand-teal data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}