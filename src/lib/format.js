function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Birthdays are stored as yearless fragments "--MM-DD" (current) or legacy "YYYY-MM-DD".
// Returns { month, day } as 0-based month + numeric day, or null if unparseable.
function parseMonthDay(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { month: parseInt(m[1], 10) - 1, day: parseInt(m[2], 10) };
}

export function daysUntil(dateStr) {
  const md = parseMonthDay(dateStr);
  if (!md) return null;
  const today = new Date();
  const base = midnight(today);
  let next = new Date(today.getFullYear(), md.month, md.day);
  if (next < base) next = new Date(today.getFullYear() + 1, md.month, md.day);
  return Math.round((next - base) / 86400000);
}

export function gbp(n) {
  if (n == null || n === "") return "";
  const num = Number(n);
  return `£${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`;
}

export const LIST_LABEL = {
  // Uppercase (from database)
  CURATED: "Curated List",
  LAST_MINUTE: "Last Minute",
  EXPERIENCE_DIGITAL: "Experience & Digital",
  // Legacy lowercase support
  curated: "Curated List",
  last_minute: "Last Minute",
  experience_digital: "Experience & Digital",
};

export const STATUS_LABEL = {
  // Uppercase (from database)
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
  PAST_DUE: "Past Due",
  TRIALLING: "Trialling",
  // Legacy lowercase support
  active: "Active",
  cancelled: "Cancelled",
  past_due: "Past Due",
  trialling: "Trialling",
};

export const AGE_BAND_LABEL = {
  // Uppercase (from database)
  UNDER_5: "Under 5",
  FIVE_TO_10: "5-10",
  ELEVEN_TO_17: "11-17",
  EIGHTEEN_TO_30: "18-30",
  THIRTY_ONE_TO_50: "31-50",
  FIFTY_ONE_TO_70: "51-70",
  SEVENTY_PLUS: "70+",
  // Legacy lowercase support (if needed)
  under_5: "Under 5",
  five_to_10: "5-10",
  eleven_to_17: "11-17",
  eighteen_to_30: "18-30",
  thirty_one_to_50: "31-50",
  fifty_one_to_70: "51-70",
  seventy_plus: "70+",
};

export const GENDER_LABEL = {
  // Uppercase (from database)
  MALE: "Male",
  FEMALE: "Female",
  NON_BINARY: "Non-binary",
  PREFER_NOT_TO_SAY: "Prefer not to say",
  // Legacy lowercase support
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Birthdays carry no year — both helpers render day + month only.
export function formatDate(dateStr) {
  return formatShortDate(dateStr);
}

export function formatShortDate(dateStr) {
  const m = String(dateStr || "").match(/(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${parseInt(m[2], 10)} ${MONTH_SHORT[parseInt(m[1], 10) - 1]}`;
}

// ISO date-times ("2026-07-23T10:15:00.000Z") carry a year and cannot be read by the
// yearless birthday helpers above (their regex is anchored to a trailing "MM-DD").
// Use this for stored timestamps such as last_scrape_at / computed_at.
export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function countdownTone(days) {
  if (days == null) return "neutral";
  if (days <= 7) return "red";
  if (days <= 15) return "amber";
  return "green";
}