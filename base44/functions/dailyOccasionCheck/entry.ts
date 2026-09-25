import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APP_URL = 'https://app.yourememberedbygem.com';
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ===== EMAIL BRANDING =====
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

// ===== DATE HELPERS =====
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

function dateLabel(date) {
  if (!date) return "coming up soon";
  return `${date.getDate()} ${MONTHS_FULL[date.getMonth()]}`;
}

function daysUntil(date) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target - base) / 86400000);
}

function daysSince(date) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((base - target) / 86400000);
}

// ===== OCCASION RESOLVER =====
const PERSONAL_OCCASIONS = ['Birthday', 'Anniversary', 'Other'];
const FIXED_OCCASIONS = {
  'Christmas': { month: 12, day: 25 },
  "Valentine's Day": { month: 2, day: 14 }
};

async function resolveOccasionDate(occasion, year, svc) {
  const { type, day, month, date } = occasion;
  
  // Personal occasions with explicit date
  if (date) {
    const d = new Date(date);
    return new Date(year, d.getMonth(), d.getDate());
  }
  
  // Personal occasions with day/month
  if (PERSONAL_OCCASIONS.includes(type)) {
    if (!day || !month) return null;
    return new Date(year, month - 1, day);
  }
  
  // Fixed calendar occasions
  if (FIXED_OCCASIONS[type]) {
    const { month: m, day: d } = FIXED_OCCASIONS[type];
    return new Date(year, m - 1, d);
  }
  
  // Variable occasions from global_occasion_dates
  try {
    const globalDates = await svc.entities.GlobalOccasionDate.filter({
      occasion_type: type,
      year: year
    });
    
    if (globalDates.length > 0) {
      const globalDate = globalDates[0];
      return new Date(year, globalDate.month - 1, globalDate.day);
    }
  } catch (error) {
    console.error(`Error looking up global occasion date for ${type} ${year}:`, error);
  }
  
  return null;
}

async function getAllRecipientOccasions(recipient, year, svc) {
  const occasions = [];
  const recipientOccasions = recipient.occasions || [];
  
  for (const occ of recipientOccasions) {
    const date = await resolveOccasionDate(occ, year, svc);
    if (date) {
      occasions.push({
        type: occ.type,
        customLabel: occ.custom_label || occ.type,
        date: date,
        budgetMin: occ.budget_min || recipient.budget_min,
        budgetMax: occ.budget_max || recipient.budget_max
      });
    }
  }
  
  return occasions.sort((a, b) => a.date - b.date);
}

// ===== EMAIL LOG CHECKS =====
async function hasEmailBeenSent(recipientId, occasionType, emailType, year, svc) {
  try {
    const logs = await svc.entities.EmailLog.filter({
      recipient_id: recipientId,
      email_type: emailType,
      occasion_type: occasionType,
      occasion_year: year
    });
    return logs.length > 0;
  } catch (error) {
    console.error('Error checking email log:', error);
    return false;
  }
}

async function logEmailSend(data, svc) {
  try {
    await svc.entities.EmailLog.create({
      subscriber_id: data.subscriberId,
      recipient_id: data.recipientId,
      gift_list_id: data.giftListId || null,
      email_type: data.emailType,
      occasion_type: data.occasionType,
      occasion_year: data.occasionYear,
      occasion_date: data.occasionDate?.toISOString().split('T')[0],
      status: data.status || 'SENT',
      sent_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging email:', error);
  }
}

// ===== RECIPIENT PROFILE SUMMARY =====
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

// ===== MAIN CRON HANDLER =====
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check: Only admin can trigger scheduled function
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
    let emailsSent = 0;

    console.log(`\n🔍 Daily Occasion Check - ${new Date().toISOString()}`);
    console.log(`📊 Scanning ${recipients.length} recipients\n`);

    for (const recipient of recipients) {
      const subscriber = recipient.subscriber_id
        ? await svc.entities.Subscriber.get(recipient.subscriber_id).catch(() => null)
        : null;
      
      if (!subscriber?.email) {
        console.log(`⏭️  Skipping ${recipient.name} - no subscriber email`);
        continue;
      }

      // Get all occasions for this recipient
      const occasions = await getAllRecipientOccasions(recipient, currentYear, svc);
      
      if (occasions.length === 0) {
        console.log(`⏭️  ${recipient.name} - no valid occasions`);
        continue;
      }

      console.log(`\n👤 ${recipient.name} - ${occasions.length} occasion(s)`);

      for (const occasion of occasions) {
        const until = daysUntil(occasion.date);
        const since = daysSince(occasion.date);
        const occasionLabel = occasion.customLabel;
        
        console.log(`   📅 ${occasionLabel}: ${dateLabel(occasion.date)} (${until} days)`);

        const greetName = escapeHtml(subscriber.first_name || subscriber.name || "there");
        const name = escapeHtml(recipient.name || "your special someone");
        const editLink = `${APP_URL}/people?edit=${recipient.id}`;

        // ===== IMMEDIATE GENERATION: <42 days or exactly 42 days =====
        if (until <= 42 && until > 2) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'SIX_WEEK_REMINDER',
            currentYear,
            svc
          );

          if (!alreadySent) {
            console.log(`      ✉️  Sending immediate gift generation email (${until} days)`);

            // Generate gift list (call existing generateGiftList function)
            try {
              const giftListResponse = await fetch(`${APP_URL}/api/gift-lists/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipientId: recipient.id,
                  occasionType: occasion.type,
                  occasionDate: occasion.date.toISOString().split('T')[0],
                  budgetMin: occasion.budgetMin,
                  budgetMax: occasion.budgetMax
                })
              });

              const giftList = await giftListResponse.json();
              const giftListId = giftList.id;

              // Send email with gift list
              const heading = `${occasionLabel} Gift Ideas for ${name}`;
              const innerHtml = `<p>Hi ${greetName},</p>
<p>${name}'s ${escapeHtml(occasionLabel.toLowerCase())} is coming up on ${dateLabel(occasion.date)} — only ${until} days away!</p>
<p>I've curated a special collection of gift ideas based on what you've told me about ${name}:</p>
${knownRows(recipient)}
${ctaButton(`View Gift Ideas →`, `${APP_URL}/gifts/${giftListId}`)}
<p>All items are in stock and ready to order.</p>`;

              await sendBrandedEmail(
                subscriber.email,
                `${occasionLabel} Gift Ideas for ${name}`,
                heading,
                innerHtml,
                null
              );

              await logEmailSend({
                subscriberId: subscriber.id,
                recipientId: recipient.id,
                giftListId: giftListId,
                emailType: 'SIX_WEEK_REMINDER',
                occasionType: occasion.type,
                occasionYear: currentYear,
                occasionDate: occasion.date,
                status: 'SENT'
              }, svc);

              emailsSent++;
              results.push({
                recipient: recipient.name,
                occasion: occasionLabel,
                type: 'immediate_generation',
                days: until
              });
            } catch (error) {
              console.error(`      ❌ Failed to generate gift list:`, error);
            }
          } else {
            console.log(`      ⏭️  Gift list already generated`);
          }
        }

        // ===== 2-WEEK REMINDER: 14 days before =====
        else if (until === 14) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'FOURTEEN_DAY',
            currentYear,
            svc
          );

          if (!alreadySent) {
            console.log(`      ✉️  Sending 2-week reminder`);

            const heading = `Only 2 Weeks Until ${occasionLabel}!`;
            const innerHtml = `<p>Hi ${greetName},</p>
<p>Quick reminder — ${name}'s ${escapeHtml(occasionLabel.toLowerCase())} is just 2 weeks away on ${dateLabel(occasion.date)}.</p>
<p>If you haven't ordered yet, now's the time to ensure delivery arrives on time.</p>
${ctaButton(`View Your Gift Ideas →`, `${APP_URL}/gifts`)}`;

            await sendBrandedEmail(
              subscriber.email,
              `Reminder: ${occasionLabel} in 2 weeks`,
              heading,
              innerHtml,
              null
            );

            await logEmailSend({
              subscriberId: subscriber.id,
              recipientId: recipient.id,
              emailType: 'FOURTEEN_DAY',
              occasionType: occasion.type,
              occasionYear: currentYear,
              occasionDate: occasion.date,
              status: 'SENT'
            }, svc);

            emailsSent++;
            results.push({
              recipient: recipient.name,
              occasion: occasionLabel,
              type: '2_week_reminder'
            });
          }
        }

        // ===== POST-OCCASION FOLLOW-UP: 2 days after =====
        else if (since === 2) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'POST_OCCASION',
            currentYear,
            svc
          );

          if (!alreadySent) {
            console.log(`      ✉️  Sending post-occasion feedback request`);

            const heading = `How Did ${occasionLabel} Go?`;
            const innerHtml = `<p>Hi ${greetName},</p>
<p>I hope ${name} had a wonderful ${escapeHtml(occasionLabel.toLowerCase())}!</p>
<p>I'd love to know — did you use any of the gift ideas I suggested? Your feedback helps me get even better at finding the perfect gifts.</p>
${ctaButton(`Share Feedback →`, `${APP_URL}/feedback?recipient=${recipient.id}`)}
<p>Thanks for trusting You Remembered by Gem!</p>`;

            await sendBrandedEmail(
              subscriber.email,
              `How did ${occasionLabel} go?`,
              heading,
              innerHtml,
              null
            );

            await logEmailSend({
              subscriberId: subscriber.id,
              recipientId: recipient.id,
              emailType: 'POST_OCCASION',
              occasionType: occasion.type,
              occasionYear: currentYear,
              occasionDate: occasion.date,
              status: 'SENT'
            }, svc);

            emailsSent++;
            results.push({
              recipient: recipient.name,
              occasion: occasionLabel,
              type: 'post_occasion'
            });
          }
        }
      }
    }

    console.log(`\n✅ Daily check complete`);
    console.log(`   Recipients scanned: ${recipients.length}`);
    console.log(`   Emails sent: ${emailsSent}\n`);

    return Response.json({
      success: true,
      scanned: recipients.length,
      emailsSent,
      results
    });
  } catch (error) {
    console.error('❌ Daily occasion check failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
