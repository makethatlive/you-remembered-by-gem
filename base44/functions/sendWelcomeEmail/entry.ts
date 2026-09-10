import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_URL = 'https://app.yourememberedbygem.com';

// Branded HTML wrapper + Resend send — Deep Teal header, gold divider, cream body.
// Escape user-controlled text (e.g. subscriber name) before interpolating into the
// HTML email body — never trust free text as raw HTML.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function wrapBrandedEmail(heading, innerHtml, footerNote) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:520px;margin:0 auto;">
  <div style="background:#164E63;padding:28px 24px 22px;text-align:center;">
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#FDFAF5;margin:0;">You Remembered, <span style="font-style:italic;">by Gem</span></p>
  </div>
  <div style="height:4px;background:#C9A96E;"></div>
  <div style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a1a2e;margin:0 0 16px;">${heading}</h1>
    <div style="color:#1a1a2e;font-size:15px;line-height:1.6;">${innerHtml}</div>
  </div>
  <div style="height:1px;background:rgba(201,169,110,0.3);margin:0 24px;"></div>
  <div style="padding:16px 24px 32px;">
    <p style="font-size:12px;color:#1a1a2e;opacity:0.5;margin:0;">You Remembered, by Gem</p>
    ${footerNote ? `<p style="font-size:11px;color:#1a1a2e;opacity:0.4;margin:8px 0 0;">${footerNote}</p>` : ""}
  </div>
</div>
</body></html>`;
}

function ctaButton(label, href) {
  return `<p style="margin:24px 0;"><a href="${href}" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:13px 28px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:14px;display:inline-block;">${label}</a></p>`;
}

async function sendBrandedEmail(to, subject, heading, innerHtml, footerNote) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'You Remembered, by Gem <concierge@yourememberedbygem.com>',
      to,
      subject,
      html: wrapBrandedEmail(heading, innerHtml, footerNote),
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

// Fired by the Subscriber "create" automation — sends the welcome email immediately
// on signup. Gated via EmailLog so a subscriber only ever receives it once
// (the Subscriber record can be (re)created/linked on login, so dedupe matters).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));

    // Sibling auth guard (see sendOnboardingEmail / autoGenerateOnRecipient). The
    // Subscriber -> create automation does not reliably carry an admin user session, so a
    // well-formed Subscriber automation envelope is accepted alongside a real admin
    // caller. Residual risk: the envelope check is spoofable by anyone who can reach this
    // endpoint — the blast radius is one welcome email to an existing subscriber.
    const ev = body?.event;
    const isAutomation = ev?.entity_name === "Subscriber" && typeof ev?.entity_id === "string";
    const user = await base44.auth.me().catch(() => null);
    if (!user && !isAutomation) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user && user.role !== "admin" && !isAutomation) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const subscriberId = body?.event?.entity_id || body?.subscriber_id;
    if (!subscriberId) {
      return Response.json({ error: "subscriber_id is required" }, { status: 400 });
    }

    const subscriber = await svc.entities.Subscriber.get(subscriberId).catch(() => null);
    if (!subscriber?.email) {
      return Response.json({ status: "skipped", reason: "no_email" });
    }

    // Only send once per subscriber — and once per EMAIL ADDRESS. A paid signup can leave
    // a second (user-owned) Subscriber row for the same person, and that row's create
    // automation would otherwise fire a second welcome, so check every row sharing the
    // address, not just this one. Only a SUCCESSFUL send blocks a retry, otherwise a Resend
    // failure would permanently lock the subscriber out of their welcome email.
    const sameEmail = await svc.entities.Subscriber.filter({ email: subscriber.email }).catch(() => []);
    const relatedIds = Array.from(
      new Set([subscriberId, ...sameEmail.map((row) => row.id).filter(Boolean)])
    );
    for (const relatedId of relatedIds) {
      const prior = await svc.entities.EmailLog.filter({
        subscriber_id: relatedId,
        email_type: "welcome",
        status: "sent",
      });
      if (prior.length > 0) {
        return Response.json({ status: "already_sent" });
      }
    }

    const greetName = escapeHtml(subscriber.first_name || subscriber.name || "there");
    const innerHtml = `<p>Hi ${greetName},</p>
<p>Welcome — and thank you for subscribing to You Remembered, by Gem. I'm genuinely delighted you're here.</p>
<p>Here's the simple promise I'm making to you: you will never again forget someone who matters, or find yourself scrambling for a last-minute gift that doesn't really say what you wanted it to say.</p>
<p>From now on, I've got that covered.</p>
<p><b>Here's how it works:</b></p>
<p><b>1. Add your people</b><br/>Log in and complete a profile for everyone you'd like to remember — up to 10 people. Add as much or as little detail as you like right now. The more you tell me, the better your ideas will be — but even the basics are enough to get started.</p>
${ctaButton("Add your people →", APP_URL)}
<p><b>2. Relax</b><br/>Six weeks before each occasion, I'll email you to check in and give you a chance to add any fresh detail — a new hobby, a recent life moment, anything that might shape the perfect gift.</p>
<p><b>3. Receive five beautiful ideas</b><br/>Four weeks before the occasion, five carefully chosen gift ideas land in your inbox — each one selected with that specific person in mind, with a direct link to buy. No faff, no generic suggestions, no last-minute panic.</p>
<p>That's it.</p>
<p><b>And one more thing — your three bonus gift consultations</b><br/>Life doesn't only happen on birthdays. As part of your subscription you have three bonus gift consultations each year — for a wedding, a new baby, a graduation, a first home, a new job, or simply a moment that deserves to be marked properly. Just drop me an email and I'll come back to you with five ideas. Think of them as your secret weapon for every unexpected celebration.</p>
<p><b>A note from me</b><br/>You Remembered, by Gem is a personal service — there's a real human behind every set of recommendations. Profile updates, budgets, and adding new people are all quick to do any time in your account — just log in and edit directly. But if anything isn't working, or something doesn't feel right, email me directly and I'll come straight back to you.</p>
<p>I'm so glad you've trusted me with the people who matter most to you.</p>
<p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com<br/>@yourememberedbygem</p>`;

    const footerNote = `You're receiving this because you recently subscribed to You Remembered, by Gem. To manage your account or unsubscribe, click <a href="${APP_URL}" style="color:#164E63;">here</a>.`;

    let status = "sent";
    try {
      await sendBrandedEmail(subscriber.email, "Welcome to You Remembered, by Gem — let's get started ✨", "Welcome", innerHtml, footerNote);
    } catch {
      status = "failed";
    }

    await svc.entities.EmailLog.create({
      subscriber_id: subscriberId,
      email_type: "welcome",
      sent_at: new Date().toISOString(),
      status,
    });

    return Response.json({ status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});