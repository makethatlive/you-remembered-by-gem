import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ["Men", "Women", "Unisex (Adult)", "Kids", "Unisex + Kids"];

// Map database enum values to display values
const CATEGORY_ENUM_TO_DISPLAY = {
  "MEN": "Men",
  "WOMEN": "Women", 
  "UNISEX_ADULT": "Unisex (Adult)",
  "KIDS": "Kids",
  "UNISEX_KIDS": "Unisex + Kids",
};

// Map display values to database enum values
const CATEGORY_DISPLAY_TO_ENUM = {
  "Men": "MEN",
  "Women": "WOMEN",
  "Unisex (Adult)": "UNISEX_ADULT",
  "Kids": "KIDS",
  "Unisex + Kids": "UNISEX_KIDS",
};

export default function RetailerForm({ retailer, onDone }) {
  const queryClient = useQueryClient();
  const isEdit = !!retailer?.id;
  
  // Normalize category from database enum to display format
  const initialCategory = retailer?.category 
    ? (CATEGORY_ENUM_TO_DISPLAY[retailer.category] || retailer.category)
    : "";
  
  const [form, setForm] = useState({
    name: retailer?.name || "",
    website_url: retailer?.websiteUrl || retailer?.website_url || "",
    gift_page_url: retailer?.giftPageUrl || retailer?.gift_page_url || "",
    category: initialCategory,
    applies_to: retailer?.appliesTo || retailer?.applies_to || "",
    contains_age_restricted_items: retailer?.containsAgeRestrictedItems ?? retailer?.contains_age_restricted_items ?? false,
    what_they_sell: retailer?.whatTheySell || retailer?.what_they_sell || "",
    why_it_fits: retailer?.whyItFits || retailer?.why_it_fits || "",
    active: retailer?.active ?? true,
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit
        ? base44.entities.Retailer.update(retailer.id, payload)
        : base44.entities.Retailer.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailers"] });
      onDone();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!form.name.trim()) er.name = "Name is required";
    if (!form.website_url.trim()) er.website_url = "Website URL is required";
    if (!form.gift_page_url.trim()) er.gift_page_url = "Gift Page URL is required";
    if (!form.category) er.category = "Category is required";
    
    // Validate URLs
    if (form.website_url && !form.website_url.match(/^https?:\/\//)) {
      er.website_url = "Website URL must start with http:// or https://";
    }
    
    // Auto-fix gift_page_url if it's a relative path
    let giftPageUrl = form.gift_page_url.trim();
    if (giftPageUrl && !giftPageUrl.match(/^https?:\/\//)) {
      // If it's a relative path (starts with / or is just a path), combine with website URL
      if (form.website_url.match(/^https?:\/\//)) {
        try {
          const baseUrl = new URL(form.website_url);
          if (giftPageUrl.startsWith('/')) {
            giftPageUrl = `${baseUrl.origin}${giftPageUrl}`;
          } else {
            giftPageUrl = `${baseUrl.origin}/${giftPageUrl}`;
          }
        } catch (e) {
          er.gift_page_url = "Gift Page URL must be a valid URL or path";
        }
      } else {
        er.gift_page_url = "Gift Page URL must be a full URL (starting with http:// or https://) or valid Website URL is required to convert relative paths";
      }
    }
    
    setErrors(er);
    if (Object.keys(er).length) return;
    
    // Convert category from display format to enum format for database
    const payload = {
      ...form,
      gift_page_url: giftPageUrl,
      category: CATEGORY_DISPLAY_TO_ENUM[form.category] || form.category,
    };
    
    mutation.mutate(payload);
  };

  return (
    <div className="max-w-2xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <button
        onClick={onDone}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Retailers
      </button>
      <h1 className="font-display text-2xl text-brand-dark mb-6">
        {isEdit ? `Edit ${retailer.name}` : "Add Retailer"}
      </h1>

      <form onSubmit={submit} className="space-y-5">
        <Field label="Name" error={errors.name}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-12" />
        </Field>
        <Field label="Website URL" error={errors.website_url}>
          <Input value={form.website_url} onChange={(e) => set("website_url", e.target.value)} className="h-12" placeholder="https://example.com" />
        </Field>
        <Field label="Gift Page URL" error={errors.gift_page_url} helper="Full URL (https://...) or relative path (/gifts) - will be combined with Website URL">
          <Input value={form.gift_page_url} onChange={(e) => set("gift_page_url", e.target.value)} className="h-12" placeholder="https://example.com/gifts or /gifts" />
        </Field>
        <Field label="Category" error={errors.category}>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Applies To">
          <Input value={form.applies_to} onChange={(e) => set("applies_to", e.target.value)} className="h-12" />
        </Field>

        <ToggleRow
          label="Contains Age Restricted Items"
          checked={form.contains_age_restricted_items}
          onChange={(v) => set("contains_age_restricted_items", v)}
        />

        <Field label="What They Sell">
          <Textarea value={form.what_they_sell} onChange={(e) => set("what_they_sell", e.target.value)} rows={3} />
        </Field>
        <Field label="Why It Fits">
          <Textarea value={form.why_it_fits} onChange={(e) => set("why_it_fits", e.target.value)} rows={3} />
        </Field>

        <ToggleRow
          label="Active"
          checked={form.active}
          onChange={(v) => set("active", v)}
        />

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:bg-brand-teal-dark disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Add Retailer"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, error, helper, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-body text-sm text-brand-dark/80">{label}</Label>
      {helper && <p className="font-body text-xs text-brand-dark/45">{helper}</p>}
      {children}
      {error && <p className="text-xs text-red-500 font-body">{error}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between bg-brand-cream-card rounded-xl shadow-sm px-4 py-3">
      <Label className="font-body text-sm text-brand-dark/80">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}