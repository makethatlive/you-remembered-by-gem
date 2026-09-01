import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@18.5.0';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mapSubscriptionStatus(status) {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialling';
  if (status === 'canceled') return 'cancelled';
  return 'past_due';
}

// Several Subscriber rows can share an email or Stripe customer (the webhook creates one
// before the user signs in, completePaidSignup then creates the user-owned one and retires
// the first as 'cancelled'). Update only the live row(s) so a retired row is never flipped
// back to active. If every match is cancelled there is nothing to prefer — keep them all,
// which is the pre-existing behaviour for a genuine re-subscription.
function liveSubscribers(subscribers) {
  const live = subscribers.filter((subscriber) => subscriber.subscription_status !== 'cancelled');
  return live.length > 0 ? live : subscribers;
}

async function upsertSubscriber(base44, data) {
  const existing = await base44.asServiceRole.entities.Subscriber.filter({ email: data.email });

  if (existing.length > 0) {
    const targets = liveSubscribers(existing);
    for (const subscriber of targets) {
      await base44.asServiceRole.entities.Subscriber.update(subscriber.id, data);
    }
    return targets[0];
  }

  return base44.asServiceRole.entities.Subscriber.create(data);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeKey || !webhookSecret) {
      return Response.json({ error: 'Stripe webhook configuration is incomplete' }, { status: 500 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return Response.json({ error: 'Missing Stripe signature' }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);
    const payload = await req.text();
    const event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
    const base44 = createClientFromRequest(req);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = (session.metadata?.email || session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || '';
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || '';
      const signupAttempts = email ? await base44.asServiceRole.entities.SignupAttempt.filter({ email }) : [];
      const signupAttempt = signupAttempts[0];
      const name = signupAttempt?.name || session.metadata?.name || session.customer_details?.name || email;

      if (email) {
        await upsertSubscriber(base44, {
          email,
          name,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          subscribed_since: today(),
        });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || '';
      const email = (subscription.metadata?.email || '').trim().toLowerCase();
      let subscribers = [];

      if (customerId) {
        subscribers = await base44.asServiceRole.entities.Subscriber.filter({ stripe_customer_id: customerId });
      }
      if (subscribers.length === 0 && email) {
        subscribers = await base44.asServiceRole.entities.Subscriber.filter({ email });
      }

      const subscriptionStatus = event.type === 'customer.subscription.deleted'
        ? 'cancelled'
        : mapSubscriptionStatus(subscription.status);

      for (const subscriber of liveSubscribers(subscribers)) {
        await base44.asServiceRole.entities.Subscriber.update(subscriber.id, {
          stripe_customer_id: customerId || subscriber.stripe_customer_id,
          stripe_subscription_id: subscription.id,
          subscription_status: subscriptionStatus,
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
});