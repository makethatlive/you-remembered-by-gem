import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Pre-auth signup eligibility check (Phase A2).
//
// CreateAccount runs BEFORE the visitor has an account, so it cannot read the Subscriber
// entity once owner-scoped RLS is published. This function performs that one lookup in a
// service context on the client's behalf.
//
// SECURITY: this endpoint is reachable WITHOUT authentication by design. It must therefore
// return nothing but a boolean — no record data, no subscriber name, no subscription
// status, and no error text that distinguishes "no such subscriber" from "subscriber found
// but not paid". Anything richer turns it into an email-probing oracle. Do not extend the
// success payload.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const { email } = await req.json().catch(() => ({}));
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) return Response.json({ error: "email is required" }, { status: 400 });

    // The paid-signup paths that create the record this check looks for store the email
    // trimmed + lowercased (stripeWebhook:52, completePaidSignup:40), so a plain equality
    // filter is exact here. (The post-login client creates in Home.jsx/Onboarding.jsx pass
    // user.email verbatim, but those rows only exist for already-authenticated users and
    // are never the row a pre-auth CreateAccount visitor is waiting on.)
    const matches = await svc.entities.Subscriber.filter({ email: cleanEmail });
    const eligible = (matches || []).some((subscriber) =>
      ["active", "trialling", "past_due"].includes(subscriber.subscription_status)
    );

    return Response.json({ eligible });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
