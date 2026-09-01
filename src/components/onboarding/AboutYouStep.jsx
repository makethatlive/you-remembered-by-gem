import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Field } from "./Fields";
import { HEARD_ABOUT_OPTIONS } from "./options";

export default function AboutYouStep({ form, errors, email, saving, set, onContinue }) {
  const heardIsOther = form.heard_choice === "Other";

  return (
    <div>
      <h1 className="font-display text-3xl text-brand-dark mb-2 leading-snug">
        First, a little about you
      </h1>
      <p className="font-body text-sm text-brand-dark/55 mb-7">
        Just so Gem knows who she's curating for.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); onContinue(); }}
        className="space-y-5"
      >
        <Field label="First name" error={errors.first_name}>
          <Input
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
            className="h-12"
            placeholder="e.g. Sarah"
          />
        </Field>

        <Field label="Email">
          <Input value={email} readOnly disabled className="h-12 bg-brand-dark/5" />
        </Field>

        <Field label="How did you hear about us?" error={errors.heard_choice}>
          <Select value={form.heard_choice} onValueChange={(v) => set("heard_choice", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Please choose" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {HEARD_ABOUT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {heardIsOther && (
            <Input
              value={form.heard_other}
              onChange={(e) => set("heard_other", e.target.value)}
              className="h-12 mt-2"
              placeholder="Please tell us how"
            />
          )}
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-gold text-brand-dark font-body font-semibold rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Continue
        </button>
      </form>
    </div>
  );
}