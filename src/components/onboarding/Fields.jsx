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
// If options include "Other", shows a text input when checked.
export function CheckboxGroup({ options, value = [], onChange, max, otherText = "", onOtherTextChange }) {
  const toggle = (opt) => {
    const has = value.includes(opt);
    if (has) {
      onChange(value.filter((v) => v !== opt));
      // Clear other text when unchecking "Other"
      if (opt === "Other" && onOtherTextChange) {
        onOtherTextChange("");
      }
    } else {
      if (max && value.length >= max) return;
      onChange([...value, opt]);
    }
  };

  const hasOther = options.includes("Other");
  const isOtherChecked = value.includes("Other");
  const regularOptions = hasOther ? options.filter(o => o !== "Other") : options;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
        {regularOptions.map((opt) => {
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
      
      {/* Other option with text input */}
      {hasOther && (
        <div className="space-y-2 pt-2 border-t border-brand-dark/10">
          <label className="flex items-start gap-2.5 font-body text-sm text-brand-dark/80 cursor-pointer">
            <Checkbox
              checked={isOtherChecked}
              disabled={!isOtherChecked && max && value.length >= max}
              onCheckedChange={() => toggle("Other")}
              className="mt-0.5 border-brand-teal data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
            />
            <span>Other</span>
          </label>
          
          {isOtherChecked && onOtherTextChange && (
            <div className="pl-8">
              <input
                type="text"
                value={otherText}
                onChange={(e) => onOtherTextChange(e.target.value)}
                placeholder="Please specify"
                className="w-full h-9 px-3 py-2 text-sm border border-brand-dark/20 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}