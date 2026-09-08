import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import AboutYouStep from "@/components/onboarding/AboutYouStep";
import PersonForm from "@/components/onboarding/PersonForm";
import { ageBandFromRange, ageBandFromChildBracket, genderValue } from "@/components/onboarding/options";

const MAX_PEOPLE = 10;
const pad = (n) => String(n).padStart(2, "0");

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // step: "about" | "person" | "added" | "done"
  const [step, setStep] = useState("about");
  const [aboutForm, setAboutForm] = useState({ first_name: "", heard_choice: "", heard_other: "" });
  const [aboutErrors, setAboutErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastName, setLastName] = useState("");
  const [count, setCount] = useState(0);

  const setAbout = (k, v) => setAboutForm((f) => ({ ...f, [k]: v }));

  // A freshly-registered user arrives here straight from sign-up, before a Subscriber
  // record has been created elsewhere. Guarantee one exists (matching by user id, then
  // email) so the steps below never operate on an undefined subscriber and blank-screen.
  const ensureSubscriber = async () => {
    const ownedByUser = await base44.entities.Subscriber.filter({ created_by_id: user.id });
    if (ownedByUser.length > 0) return ownedByUser[0];

    // A record created at checkout (Stripe webhook) is owned by the service, so this user
    // cannot read it — never gate linkage on being able to see it. Link server-side
    // unconditionally, then re-check for an owned record so the writes below land on it.
    try {
      await base44.functions.invoke("completePaidSignup", {});
    } catch {
      // Linkage is best-effort — fall through to the lookups below.
    }
    const linked = await base44.entities.Subscriber.filter({ created_by_id: user.id });
    if (linked.length > 0) return linked[0];

    // By-email match purely as a fallback — it is fine for this to come back empty.
    const byEmail = user?.email
      ? await base44.entities.Subscriber.filter({ email: user.email })
      : [];
    if (byEmail.length > 0) return byEmail[0];

    // Use the name captured at registration (Register.jsx) if present, since the
    // auth user's full_name is never set by that flow.
    const pendingName = window.localStorage.getItem("pendingSubscriberName");
    const subscriber = await base44.entities.Subscriber.create({
      name: pendingName || user.full_name || user.email,
      email: user.email,
      subscription_status: "trialling",
    });
    window.localStorage.removeItem("pendingSubscriberName");
    return subscriber;
  };

  const continueFromAbout = async () => {
    const er = {};
    if (!aboutForm.first_name.trim()) er.first_name = "First name is required";
    if (!aboutForm.heard_choice) er.heard_choice = "Please choose an option";
    setAboutErrors(er);
    if (Object.keys(er).length) return;

    setSaving(true);
    try {
      const subscriber = await ensureSubscriber();
      const heard =
        aboutForm.heard_choice === "Other"
          ? (aboutForm.heard_other.trim() || "Other")
          : aboutForm.heard_choice;
      if (subscriber?.id) {
        await base44.entities.Subscriber.update(subscriber.id, {
          first_name: aboutForm.first_name.trim(),
          how_heard: heard,
        });
      }
      setStep("person");
    } finally {
      setSaving(false);
    }
  };

  const savePerson = async (p) => {
    setSaving(true);
    try {
      const subscriber = await ensureSubscriber();

      const relationship =
        p.relationship === "Other" ? (p.relationship_other.trim() || "Other") : p.relationship;

      // Multiple occasions can be selected; the "Birthday" one (or the first selected)
      // mirrors into the legacy occasion/occasion_day/occasion_month/budget fields so
      // existing reminder automations keep working off a single primary occasion.
      const primary = p.occasions.find((o) => o.type === "Birthday") || p.occasions[0];
      const primaryLabel = primary.type === "Other" ? (primary.custom_label.trim() || "Other") : primary.type;
      const day = Number(primary.day);
      const month = Number(primary.month);
      const isChild = p.age_range === "Under 11";

      await base44.entities.Recipient.create({
        subscriber_id: subscriber?.id,
        name: p.name.trim(),
        relationship,
        occasion: primaryLabel,
        occasion_day: day,
        occasion_month: month,
        occasions: p.occasions.map((o) => ({
          type: o.type === "Other" ? (o.custom_label.trim() || "Other") : o.type,
          custom_label: o.type === "Other" ? o.custom_label.trim() : undefined,
          day: Number(o.day),
          month: Number(o.month),
          budget_min: Number(o.budget_min),
          budget_max: Number(o.budget_max),
        })),
        // Occasion date stored as yearless fragment so all reminder timing keeps working.
        birthday: `--${pad(month)}-${pad(day)}`,
        gender: genderValue(p.gender),
        age_range: p.age_range,
        child_age_bracket: isChild ? p.child_age_bracket : undefined,
        age_band: isChild ? ageBandFromChildBracket(p.child_age_bracket) : ageBandFromRange(p.age_range),
        budget_min: Number(primary.budget_min),
        budget_max: Number(primary.budget_max),
        interests: p.interests,
        personality: p.personality,
        gift_types: p.gift_types,
        avoid_notes: p.avoid_notes.trim() || undefined,
        hobbies_and_interests: p.hobbies_and_interests.trim() || undefined,
        things_you_know: p.things_you_know.trim() || undefined,
        milestones: p.milestones.trim() || undefined,
        who_they_are: p.who_they_are.trim() || undefined,
        notes: p.notes.trim() || undefined,
      });

      setLastName(p.name.trim());
      setCount((c) => c + 1);
      setStep("added");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-scroll bg-brand-cream font-body text-brand-dark min-h-[100dvh] flex flex-col">
      <div className="w-full max-w-lg mx-auto px-5 pt-5 flex justify-end">
        <button
          onClick={() => base44.auth.logout()}
          className="font-body text-sm text-brand-dark/60 underline hover:text-brand-dark min-h-[44px]"
        >
          Log out
        </button>
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto px-5 py-10">
        {step === "about" && (
          <AboutYouStep
            form={aboutForm}
            errors={aboutErrors}
            email={user?.email || ""}
            saving={saving}
            set={setAbout}
            onContinue={continueFromAbout}
          />
        )}

        {step === "person" && (
          <PersonForm
            key={count}
            index={count}
            total={MAX_PEOPLE}
            saving={saving}
            onSubmit={savePerson}
          />
        )}

        {step === "added" && (
          <Added
            name={lastName}
            count={count}
            canAddMore={count < MAX_PEOPLE}
            onAddAnother={() => setStep("person")}
            onDone={() => setStep("done")}
          />
        )}

        {step === "done" && <Done count={count} onGo={() => navigate("/")} />}
      </div>
    </div>
  );
}

function Added({ name, count, canAddMore, onAddAnother, onDone }) {
  return (
    <div className="text-center pt-8">
      <h1 className="font-display text-3xl text-brand-dark mb-3 leading-snug">
        Brilliant — {name} is added.
      </h1>
      <p className="font-body text-sm text-brand-dark/55 mb-8">
        {canAddMore
          ? "Would you like to add another person? You can add up to 10."
          : "That's all 10 people added — your full list is complete."}
      </p>
      {canAddMore && (
        <button
          onClick={onAddAnother}
          className="w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3.5 min-h-[44px] hover:bg-brand-teal-dark mb-4"
        >
          + Add another person
        </button>
      )}
      <button
        onClick={onDone}
        className="font-body text-sm text-brand-teal font-medium hover:underline min-h-[44px]"
      >
        I'm done for now
      </button>
    </div>
  );
}

function Done({ count, onGo }) {
  const word = count === 1 ? "person" : "people";
  return (
    <div className="text-center pt-8">
      <h1 className="font-display text-3xl text-brand-dark mb-3 leading-snug">
        You're all set!
      </h1>
      <p className="font-body text-sm text-brand-dark/55 mb-8">
        Gem now has {count} {word} to look after. You'll hear from her ahead of each occasion
        with thoughtful gift ideas.
      </p>
      <button
        onClick={onGo}
        className="w-full bg-brand-gold text-brand-dark font-body font-semibold rounded-xl py-3.5 min-h-[44px] hover:brightness-95"
      >
        Go to my dashboard
      </button>
    </div>
  );
}