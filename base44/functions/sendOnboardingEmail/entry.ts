import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_URL = 'https://app.yourememberedbygem.com';

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

// Scheduled every 10 minutes. Sends the onboarding-form nudge 30 minutes after a
// subscriber signs up. Bounded to signups from the last 24 hours so a first
// deployment never backfills every historic subscriber; gated via EmailLog so
// it only ever sends once per subscriber.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled automations run with a valid authenticated (admin) context, so a failed
    // auth check must always reject outright — never fall back to an "allowed" state.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const now = Date.now();
    const cutoff30 = new Date(now - 30 * 60 * 1000);
    const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);

    const subscribers = await svc.entities.Subscriber.list("-created_date", 5000);
    let sent = 0;

    for (const subscriber of subscribers) {
      if (!subscriber.email || !subscriber.created_date) continue;
      const createdAt = new Date(subscriber.created_date);
      if (createdAt > cutoff30 || createdAt < cutoff24h) continue;

      const prior = await svc.entities.EmailLog.filter({
        subscriber_id: subscriber.id,
        email_type: "onboarding_reminder",
      });
      if (prior.length > 0) continue;

      const greetName = escapeHtml(subscriber.first_name || subscriber.name || "there");
      const innerHtml = `<p>Hi ${greetName},</p>
<p>You're all set up — now the fun part.</p>
<p>Head to your dashboard and add the people you'd like me to remember. For each person, I'll ask a few simple questions: their relationship to you, their age, their upcoming occasion, their interests, and your budget. The more detail you give me, the more personal your gift ideas will be.</p>
${ctaButton("Add your people →", `${APP_URL}/people`)}
<p>You can add up to 10 people and come back to update their profiles any time.</p>
<p>Gem<br/>You Remembered, by Gem</p>`;

      let status = "sent";
      try {
        await sendBrandedEmail(subscriber.email, "Now, tell me about the people who matter most to you 🎁", "Now for the fun part", innerHtml);
      } catch {
        status = "failed";
      }

      await svc.entities.EmailLog.create({
        subscriber_id: subscriber.id,
        email_type: "onboarding_reminder",
        sent_at: new Date().toISOString(),
        status,
      });
      sent++;
    }

    return Response.json({ scanned: subscribers.length, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
