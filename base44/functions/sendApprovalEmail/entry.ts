import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_URL = 'https://app.yourememberedbygem.com';
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Branded HTML wrapper + Resend send — Deep Teal header, gold divider, cream body.
function wrapBrandedEmail(heading, innerHtml, footerNote) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FDFAF5;">
<div style="max-width:560px;margin:0 auto;">
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
  return `<p style="margin:20px 0;"><a href="${href}" style="background:#164E63;color:#FDFAF5;text-decoration:none;padding:11px 22px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:13px;display:inline-block;">${label}</a></p>`;
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

// Map list_type → EmailLog email_type (unchanged from before).
const TYPE_META = {
  curated: { email_type: "30_day" },
  last_minute: { email_type: "14_day", subject: (name) => `⏰ Last minute gift ideas for ${name}` },
  experience_digital: { email_type: "7_day", subject: (name) => `✨ Experience & gift ideas for ${name}` },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseMonthDay(dateStr) {
  const m = String(dateStr || "").match(/(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { month: parseInt(m[1], 10) - 1, day: parseInt(m[2], 10) };
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

function dateLabel(date) {
  if (!date) return "coming up soon";
  return `${date.getDate()} ${MONTHS_FULL[date.getMonth()]}`;
}

function weeksAwayFrom(date) {
  if (!date) return null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date - base) / 86400000);
  return Math.max(0, Math.round(days / 7));
}

function gbp(n) {
  if (n == null || n === "") return "";
  const num = Number(n);
  return `£${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`;
}

// Render the approved catalogue gifts as a numbered list matching the Gift Ideas copy —
// name, retailer, price, personalised description, and a CTA per item.
function renderItems(items) {
  return items.map((it, i) => {
    const link = it.affiliate_url || it.product_url || "#";
    const retailer = it.retailer_name || "the retailer";
    const desc = it.why_this_gift || it.description || "";
    return `<div style="margin:0 0 22px;">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;font-size:15px;font-weight:700;">${i + 1}. ${it.title || ""}</p>
<p style="margin:4px 0 0;color:#164E63;font-size:13px;font-weight:600;">${retailer} — ${gbp(it.price)}</p>
${desc ? `<p style="margin:6px 0 0;color:#1a1a2e;opacity:0.75;font-size:14px;line-height:1.5;">${desc}</p>` : ""}
<p style="margin:8px 0 0;"><a href="${link}" style="color:#164E63;font-size:13px;font-weight:600;text-decoration:underline;">View at ${retailer} →</a></p>
</div>`;
  }).join("");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const giftListId = body.giftListId;
    if (!giftListId) {
      return Response.json({ error: 'giftListId is required' }, { status: 400 });
    }

    // Never send the same gift_list_id twice — but only a SUCCESSFUL send blocks a
    // retry, otherwise a Resend failure would permanently lock the list out of email.
    const existing = await svc.entities.EmailLog.filter({ gift_list_id: giftListId, status: 'sent' });
    if (existing.length > 0) {
      return Response.json({ status: 'already_sent' });
    }

    const list = await svc.entities.GiftList.get(giftListId);
    if (!list) {
      return Response.json({ error: 'Gift list not found' }, { status: 404 });
    }
    // Gate: this email only ever goes out once Gem has approved the list.
    if (list.status !== 'approved') {
      return Response.json({ error: 'Gift list is not approved yet' }, { status: 400 });
    }

    const meta = TYPE_META[list.list_type] || TYPE_META.curated;

    const recipient = await svc.entities.Recipient.get(list.recipient_id);
    const subscriber = await svc.entities.Subscriber.get(list.subscriber_id);
    const recipientName = recipient?.name || 'your recipient';
    const subscriberName = subscriber?.first_name || subscriber?.name || 'there';
    const occasion = (recipient?.occasion || 'occasion').toLowerCase();

    const occDate = nextOccurrence(list.birthday_date || recipient?.birthday);
    const dateStr = dateLabel(occDate);
    const weeks = weeksAwayFrom(occDate);

    const editLink = `${APP_URL}/people?edit=${recipient?.id || ''}`;
    const summary = recipient?.who_they_are || recipient?.hobbies_and_interests || 'someone truly special';
    const budgetText =
      recipient?.budget_min != null || recipient?.budget_max != null
        ? `${gbp(recipient?.budget_min)}–${gbp(recipient?.budget_max)}`
        : '';

    const allItems = await svc.entities.GiftItem.filter({ gift_list_id: giftListId });
    const items = allItems.filter((it) => it.status === 'active').slice(0, 5);
    const itemsHtml = renderItems(items);

    const subject = list.list_type === 'curated'
      ? `Five ideas for ${recipientName}'s ${occasion} — chosen just for them ✨`
      : meta.subject(recipientName);

    const innerHtml = `<p>Hi ${subscriberName},</p>
<p>${recipientName}'s ${occasion} is on ${dateStr} — so here are five ideas I've chosen with them specifically in mind.</p>
<p>Each one reflects what you've told me about them: ${summary}.${budgetText ? ` I've kept everything within your ${budgetText} budget.` : ''}</p>
<p>Take your time browsing — every link goes directly to the retailer.</p>
<p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:19px;color:#1a1a2e;margin:24px 0 14px;">Five ideas for ${recipientName}</p>
${itemsHtml}
<p><b>A thought before you buy</b><br/>These are five ideas I genuinely think ${recipientName} would love — but you'll always know your ${recipient?.relationship || 'person'} better than I do. Have a browse through what I've suggested, and if something's not quite right — a different colour, a slightly different style — feel free to have a look around the retailer's site for an alternative. Spending just a few minutes tailoring my suggestions to what you know about them will make the end result even more perfect.</p>
<p><b>Not quite right?</b><br/>If none of these feel quite right, just email me directly at concierge@yourememberedbygem.com with a little more detail on ${recipientName} — anything at all that might help — and I'll personally look for alternatives. That's genuinely what I'm here for.</p>
<p><b>Worth knowing:</b><br/>Most retailers can deliver within a week, so if something needs a personal touch added — engraving, wrapping, a handwritten note — it's worth ordering in good time.</p>
<p>Enjoy giving,</p>
<p>Gem<br/>You Remembered, by Gem<br/>yourememberedbygem.com<br/>@yourememberedbygem</p>`;

    const footerNote = `You're receiving this as part of your You Remembered, by Gem subscription. To update ${recipientName}'s profile for next year, visit <a href="${editLink}" style="color:#164E63;">this link</a>. To manage your account or unsubscribe, click <a href="${APP_URL}" style="color:#164E63;">here</a>.`;

    let status = 'sent';
    try {
      await sendBrandedEmail(subscriber?.email, subject, 'Chosen just for them', innerHtml, footerNote);
    } catch {
      status = 'failed';
    }

    await svc.entities.EmailLog.create({
      subscriber_id: list.subscriber_id,
      recipient_id: list.recipient_id,
      gift_list_id: giftListId,
      email_type: meta.email_type,
      sent_at: today(),
      status,
    });

    return Response.json({ status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});