// Shared option lists for the onboarding / Add Someone recipient forms.
// Single source of truth — both onboarding (PersonForm) and the subscriber
// Add Someone form (RecipientForm) import from here for consistency.

import {
  INTEREST_OPTIONS as TAXONOMY_INTEREST_OPTIONS, GIFT_TYPE_OPTIONS as TAXONOMY_GIFT_TYPE_OPTIONS,
} from "@/components/shared/taxonomy";

export const HEARD_ABOUT_OPTIONS = [
  "Friend or family recommendation",
  "Instagram",
  "LinkedIn",
  "Google search",
  "Press / article",
  "Other",
];

export const RELATIONSHIP_OPTIONS = [
  "Partner",
  "Mother",
  "Father",
  "Sister",
  "Brother",
  "Daughter",
  "Son",
  "Friend",
  "Grandmother",
  "Grandfather",
  "Aunt/Uncle",
  "Nephew/Niece",
  "Godchild",
  "Other",
];

// Every recipient automatically gets these two standard occasions.
export const STANDARD_OCCASIONS = ["Birthday", "Christmas"];

// Relationship-specific occasions shown in addition to the standard ones.
export const RELATIONSHIP_OCCASION_DEFAULTS = {
  "Partner": ["Valentine's Day", "Anniversary"],
  "Mother": ["Mother's Day"],
  "Father": ["Father's Day"],
};

// Shown under "+ Additional occasions". "Other" always last and always has a free-text box.
export const ADDITIONAL_OCCASION_OPTIONS = [
  "Valentine's Day",
  "Anniversary",
  "Mother's Day",
  "Father's Day",
  "Easter",
  "Eid",
  "Diwali",
  "Hanukkah",
  "Rosh Hashanah",
  "Lunar New Year",
  "Other",
];

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const AGE_RANGES = [
  "Under 11", "12-17", "18-25", "26-35",
  "36-45", "46-55", "56-65", "66-75", "75+",
];

// Detailed age brackets collected only when age_range is "Under 11".
export const CHILD_AGE_BRACKETS = ["1-2", "3-4", "5-6", "7-8", "9-11"];

export const CHILD_INTERESTS_HELPER =
  "What are they into right now? Trucks, dinosaurs, drawing, football, princesses, space, making things — whatever it is, the more specific the better.\n\nAnd if you don't know? That's fine. Leave this blank and I'll find something brilliant for their age.";

// Map the onboarding age range onto the age_band enum the gift logic relies on.
export function ageBandFromRange(range) {
  switch (range) {
    case "12-17": return "11-17";
    case "18-25":
    case "26-35": return "18-30";
    case "36-45":
    case "46-55": return "31-50";
    case "56-65":
    case "66-75": return "51-70";
    case "75+": return "71+";
    default: return "31-50";
  }
}

// Map the detailed child age bracket onto the age_band enum.
export function ageBandFromChildBracket(bracket) {
  switch (bracket) {
    case "1-2":
    case "3-4": return "Under 5";
    case "5-6":
    case "7-8": return "5-10";
    case "9-11": return "11-17";
    default: return "5-10";
  }
}

export const GENDER_OPTIONS = ["Woman", "Man", "Non-binary", "Prefer not to say"];

// Map the UI gender label onto the gender enum the schema/gift logic uses.
export function genderValue(label) {
  if (label === "Woman") return "Female";
  if (label === "Man") return "Male";
  if (label === "Non-binary") return "Non-binary";
  return "Prefer not to say";
}

// Derived from the canonical taxonomy (src/components/shared/taxonomy.js) —
// round-3 R1. ui:true entries in canonical order, plus "Other".
export const INTEREST_OPTIONS = TAXONOMY_INTEREST_OPTIONS;

export const PERSONALITY_OPTIONS = [
  "Practical and no-nonsense", "Creative and expressive", "Social and outgoing",
  "Thoughtful and introverted", "Adventurous and spontaneous",
  "Homebody who loves comfort", "Ambitious and career-focused",
  "Funny and doesn't take themselves seriously", "Deeply sentimental",
  "Young at heart", "Hard to buy for — they have everything", "Other",
];

// Derived from the canonical taxonomy (src/components/shared/taxonomy.js) —
// round-3 R1. ui:true entries in canonical order, plus "Other".
export const GIFT_TYPE_OPTIONS = TAXONOMY_GIFT_TYPE_OPTIONS;