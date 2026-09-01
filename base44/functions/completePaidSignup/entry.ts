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

function welcomeEmail(name) {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#1a1a2e;font-size:15px;line-height:1.6;">
    <p>Hi ${escapeHtml(name)},</p>
    <p>Welcome to You Remembered, by Gem. Your account is ready and your subscription is now active.</p>
    <p style="margin:24px 0;">
      <a href="${APP_URL}" style="background:#0d4a4a;color:#f8f4ef;text-decoration:none;padding:12px 24px;border-radius:12px;font-family:Inter,Arial,sans-serif;display:inline-block;">Open your account</a>
    </p>
    <p>With love,<br/>Gem x</p>
  </div>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = (user.email || '').trim().toLowerCase();
    if (!email) {
      return Response.json({ error: 'No email found for this user.' }, { status: 400 });
    }

    const allSubscribers = await base44.asServiceRole.entities.Subscriber.filter({ email });
    const paidSubscriber = allSubscribers.find((subscriber) =>
      ['active', 'trialling', 'past_due'].includes(subscriber.subscription_status)
    );

    if (!paidSubscriber) {
      return Response.json({ error: 'No paid subscription was found for this email.' }, { status: 400 });
    }

    const attempts = await base44.asServiceRole.entities.SignupAttempt.filter({ email });
    const signupAttempt = attempts[0];
    const subscriberName = signupAttempt?.name || paidSubscriber.name || user.full_name || email;
    const ownedSubscriber = allSubscribers.find((subscriber) => subscriber.created_by_id === user.id);

    const nextData = {
      email,
      name: subscriberName,
      stripe_customer_id: paidSubscriber.stripe_customer_id,
      stripe_subscription_id: paidSubscriber.stripe_subscription_id,
      subscription_status: paidSubscriber.subscription_status || 'active',
      subscribed_since: paidSubscriber.subscribed_since || new Date().toISOString().slice(0, 10),
    };

    // The record is deliberately created/updated AS THE ACTING USER: a user-owned record
    // means created_by_id is the paying user, which generateGiftList needs to resolve
    // subscriber_user_id.
    let ownedId = ownedSubscriber?.id;
    if (ownedSubscriber) {
      await base44.entities.Subscriber.update(ownedSubscriber.id, nextData);
    } else {
      const created = await base44.entities.Subscriber.create(nextData);
      ownedId = created?.id;
    }

    // Retire the Stripe-webhook-created Subscriber row(s) for this email: hand their
    // recipients and any Stripe identifiers the owned record lacks over to the owned
    // record, then mark them cancelled so one email never has two active rows.
    // Best-effort — a failure here must never break signup completion.
    if (ownedId) {
      try {
        const svc = base44.asServiceRole;
        const stale = allSubscribers.filter((subscriber) => subscriber.id !== ownedId);

        const carried = {};
        for (const old of stale) {
          if (!nextData.stripe_customer_id && !carried.stripe_customer_id && old.stripe_customer_id) {
            carried.stripe_customer_id = old.stripe_customer_id;
          }
          if (!nextData.stripe_subscription_id && !carried.stripe_subscription_id && old.stripe_subscription_id) {
            carried.stripe_subscription_id = old.stripe_subscription_id;
          }
          if (!nextData.subscription_status && !carried.subscription_status && old.subscription_status) {
            carried.subscription_status = old.subscription_status;
          }
        }
        if (Object.keys(carried).length > 0) {
          await base44.entities.Subscriber.update(ownedId, carried);
        }

        // The Stripe identifiers the owned record ends up holding. Once they live there,
        // the retired rows must give them up — otherwise the next customer.subscription.*
        // webhook (which selects by stripe_customer_id) would flip them back to active.
        const ownedCustomerId = nextData.stripe_customer_id || carried.stripe_customer_id || '';
        const ownedSubscriptionId = nextData.stripe_subscription_id || carried.stripe_subscription_id || '';

        for (const old of stale) {
          const recipients = await svc.entities.Recipient.filter({ subscriber_id: old.id });
          for (const recipient of recipients) {
            await svc.entities.Recipient.update(recipient.id, { subscriber_id: ownedId });
          }
          const retired = {};
          if (old.subscription_status !== 'cancelled') {
            retired.subscription_status = 'cancelled';
          }
          if (ownedCustomerId && old.stripe_customer_id) {
            retired.stripe_customer_id = '';
          }
          if (ownedSubscriptionId && old.stripe_subscription_id) {
            retired.stripe_subscription_id = '';
          }
          if (Object.keys(retired).length > 0) {
            await svc.entities.Subscriber.update(old.id, retired);
          }
        }
      } catch (linkError) {
        console.error('completePaidSignup: retiring webhook Subscriber failed', linkError?.message);
      }
    }

    if (attempts.length > 0) {
      for (const attempt of attempts) {
        await base44.asServiceRole.entities.SignupAttempt.delete(attempt.id);
      }
    }

    return Response.json({ status: 'ok' });
  } catch (error) {
    console.error('completePaidSignup error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});