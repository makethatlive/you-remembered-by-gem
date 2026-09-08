import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_URL = 'https://app.yourememberedbygem.com';
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Branded HTML wrapper + Resend send — Deep Teal header, gold divider, cream body.
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

// Occasion dates are stored yearless ("--MM-DD") or legacy ("YYYY-MM-DD").
function parseMonthDay(dateStr) {
  const m = String(dateStr || "").match(/(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { month: parseInt(m[1], 10) - 1, day: parseInt(m[2], 10) };
}

function daysUntilNext(dateStr) {
  const md = parseMonthDay(dateStr);
  if (!md) return null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(base.getFullYear(), md.month, md.day);
  if (next < base) next = new Date(base.getFullYear() + 1, md.month, md.day);
  return Math.round((next - base) / 86400000);
}

function nextOccurrence(dateStr) {
  const md = parseMonthDay(dateStr);
  if (!md) return null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(base.getFullYear(), md.month, md.day);
  if (next < base) next = new Date(base.getFullYear() + 1, md.month, md.day);
  return next;
}

function daysSinceLast(dateStr) {
  const md = parseMonthDay(dateStr);
  if (!md) return null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let last = new Date(base.getFullYear(), md.month, md.day);
  if (last > base) last = new Date(base.getFullYear() - 1, md.month, md.day);
  return Math.round((base - last) / 86400000);
}

function dateLabel(date) {
  if (!date) return "coming up soon";
  return `${date.getDate()} ${MONTHS_FULL[date.getMonth()]}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Escape user-controlled text before interpolating into the HTML email body —
// recipient/subscriber fields (name, notes, interests, etc.) are free text and must
// never be trusted as raw HTML.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function gbp(n) {
  if (n == null || n === "") return "";
  const num = Number(n);
  return `£${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`;
}

// Build the "what we know" summary rows for the 6-week reminder.
function knownRows(r) {
  const rows = [];
  if (r.relationship) rows.push(["Relationship", r.relationship]);
  if (r.age_range || r.age_band) rows.push(["Age range", r.age_range || r.age_band]);
  if (Array.isArray(r.interests) && r.interests.length) rows.push(["Interests", r.interests.join(", ")]);
  if (Array.isArray(r.personality) && r.personality.length) rows.push(["Personality", r.personality.join(", ")]);
  if (Array.isArray(r.gift_types) && r.gift_types.length) rows.push(["Gift types they love", r.gift_types.join(", ")]);
  if (r.budget_min != null || r.budget_max != null) rows.push(["Budget", `${gbp(r.budget_min)} min / ${gbp(r.budget_max)} max`]);
  if (r.avoid_notes) rows.push(["Notes", r.avoid_notes]);
  if (!rows.length) return "";
  const items = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#1a1a2e;opacity:0.5;font-size:13px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#1a1a2e;font-size:14px;">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fffdf9;border:1px solid rgba(201,169,110,0.25);border-radius:14px;padding:8px 16px;">${items}</table>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled automations run with a valid authenticated (admin) context, so a failed
    // auth check must always reject outright — never fall back to an "allowed" state,
    // which would let an anonymous request trigger mass emails.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const recipients = await svc.entities.Recipient.list("-created_date", 5000);
    const currentYear = new Date().getFullYear();
    const results = [];
    let sent = 0;

    const alreadySent = async (recipientId, emailType, year) => {
      const logs = await svc.entities.EmailLog.filter({ recipient_id: recipientId, email_type: emailType });
      return logs.some((l) => l.occasion_year === year);
    };

    const logSend = async (recipient, emailType, year, status) => {
      await svc.entities.EmailLog.create({
        subscriber_id: recipient.subscriber_id,
        recipient_id: recipient.id,
        email_type: emailType,
        occasion_year: year,
        sent_at: new Date().toISOString(),
        status,
      });
    };

    for (const recipient of recipients) {
      const subscriber = recipient.subscriber_id
        ? await svc.entities.Subscriber.get(recipient.subscriber_id).catch(() => null)
        : null;
      if (!subscriber?.email) continue;

      const greetName = subscriber.first_name || subscriber.name || "there";
      const name = recipient.name || "your special someone";
      const occasion = (recipient.occasion || "occasion").toLowerCase();
      const until = daysUntilNext(recipient.birthday);
      const since = daysSinceLast(recipient.birthday);

      // ===== 6-week (42 day) reminder =====
      if (until === 42) {
        const occDate = nextOccurrence(recipient.birthday);
        const occYear = occDate.getFullYear();

        if (!(await alreadySent(recipient.id, "6_week_reminder", occYear))) {
          const giftIdeasDate = dateLabel(addDays(occDate, -28));
          const editLink = `${APP_URL}/people?edit=${recipient.id}`;
          const safeGreetName = escapeHtml(greetName);
          const safeName = escapeHtml(name);
          const safeOccasion = escapeHtml(occasion);
          const innerHtml = `<p>Hi ${safeGreetName},</p>
<p>${safeName}'s ${safeOccasion} is coming up on ${dateLabel(occDate)} — which means it's time to start finding something truly special for them.</p>
<p>I'm putting your curated gift ideas together now, and I want to make sure they're as personal and thoughtful as possible. Here's what you've told me about ${safeName} so far:</p>
${knownRows(recipient)}
<p><b>Does anything need updating?</b><br/>Life moves fast — and the best gift ideas often come from small details. Has anything changed recently? A new hobby? A big life moment? Something they've mentioned wanting?</p>
${ctaButton(`Update ${safeName}'s profile →`, editLink)}
<p>If everything looks good and you're happy for me to go ahead, you don't need to do a thing.</p>
<p>Your gift ideas will land in your inbox on ${giftIdeasDate}.</p>
<p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com</p>`;
          const footerNote = `You're receiving this because ${safeName}'s ${safeOccasion} is coming up. To manage your account or unsubscribe, click <a href="${APP_URL}" style="color:#164E63;">here</a>.`;
          let status = "sent";
          try {
            await sendBrandedEmail(
              subscriber.email,
              `It's nearly time to find something special for ${name} 🎁`,
              "Six weeks to go",
              innerHtml,
              footerNote
            );
          } catch {
            status = "failed";
          }
          await logSend(recipient, "6_week_reminder", occYear, status);
          sent++;
          results.push({ recipient: name, type: "6_week_reminder", status });
        }
      }

      // ===== Post-occasion follow-up — automatic, 2 days after =====
      if (since === 2) {
        const occYear = currentYear;
        if (!(await alreadySent(recipient.id, "post_occasion", occYear))) {
          const safeGreetName = escapeHtml(greetName);
          const safeName = escapeHtml(name);
          const safeOccasion = escapeHtml(occasion);
          const innerHtml = `<p>Hi ${safeGreetName},</p>
<p>${safeName}'s ${safeOccasion} was ${since} days ago — and I've been thinking about you.</p>
<p>Did the gift land well?</p>
<p>I ask partly because I genuinely want to know, and partly because your feedback makes next year's suggestions even better. A quick reply — even just a line or two — tells me everything I need to refine things for next time.</p>
<p><b>A few questions if you have a moment:</b></p>
<p><b>Did you buy one of the suggestions?</b><br/>
□ Yes — and it went down really well<br/>
□ Yes — the reaction was mixed<br/>
□ No — I found something else instead<br/>
□ No — I didn't end up buying a gift this time</p>
<p><b>How did they react?</b></p>
<p><b>Was there anything in the suggestions that didn't feel right?</b></p>
<p><b>Any other feedback for next year?</b></p>
<p><b>One small favour</b><br/>If You Remembered, by Gem made a difference — if it saved you time, helped you give something truly thoughtful, or simply meant you didn't have to panic — I'd be so grateful if you'd share it with one person who might love it too.</p>
<p>A personal recommendation from you means more than any advertising I could ever do. And if they subscribe, I'll add an extra bonus gift consultation to your account as a thank you.</p>
${ctaButton("Share You Remembered, by Gem →", "https://yourememberedbygem.com")}
<p>And if anything didn't hit the mark this time, please tell me. This is a personal service and I'd rather know — it's the only way to make sure next year is even better.</p>
<p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com</p>`;
          const footerNote = `You're receiving this as part of your You Remembered, by Gem subscription. To manage your account or unsubscribe, click <a href="${APP_URL}" style="color:#164E63;">here</a>.`;
          let status = "sent";
          try {
            await sendBrandedEmail(subscriber.email, "How did it go? 🎉", "How did it go?", innerHtml, footerNote);
          } catch {
            status = "failed";
          }
          await logSend(recipient, "post_occasion", occYear, status);
          sent++;
          results.push({ recipient: name, type: "post_occasion", status });
        }
      }
    }

    console.log(`Daily occasion check: ${recipients.length} recipients scanned, ${sent} emails sent.`);
    return Response.json({ scanned: recipients.length, sent, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
