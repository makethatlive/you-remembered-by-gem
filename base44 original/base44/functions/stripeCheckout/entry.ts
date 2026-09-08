import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@18.5.0';

const APP_URL = 'https://app.yourememberedbygem.com';
const PRICE_ID = 'price_1Tk0XUEF8hIFzvFe7s03V9oZ';

async function cleanupExpiredAttempts(base44) {
  const attempts = await base44.asServiceRole.entities.SignupAttempt.list('-created_date', 200);
  const cutoff = Date.now() - 60 * 60 * 1000;

  for (const attempt of attempts) {
    const createdAt = attempt.created_at || attempt.created_date;
    if (createdAt && new Date(createdAt).getTime() < cutoff) {
      await base44.asServiceRole.entities.SignupAttempt.delete(attempt.id);
    }
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return Response.json({ error: 'Stripe secret key is missing' }, { status: 500 });
    }

    const body = await req.json();
    const name = (body?.name || '').trim();
    const email = (body?.email || '').trim().toLowerCase();
    const password = body?.password || '';

    if (!name || !email || !password) {
      return Response.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    await cleanupExpiredAttempts(base44);

    const existingSubscribers = await base44.asServiceRole.entities.Subscriber.filter({ email });
    const hasExistingAccess = existingSubscribers.some((subscriber) =>
      ['active', 'trialling', 'past_due'].includes(subscriber.subscription_status)
    );

    if (hasExistingAccess) {
      return Response.json({ error: 'An active subscription already exists for this email.' }, { status: 409 });
    }

    const existingAttempts = await base44.asServiceRole.entities.SignupAttempt.filter({ email });
    for (const attempt of existingAttempts) {
      await base44.asServiceRole.entities.SignupAttempt.delete(attempt.id);
    }

    await base44.asServiceRole.entities.SignupAttempt.create({
      email,
      name,
      created_at: new Date().toISOString(),
    });

    const stripe = new Stripe(stripeKey);
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
        email,
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/create-account?checkout=success&email=${encodeURIComponent(email)}`,
      cancel_url: `${APP_URL}/signup?checkout=cancelled`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
        email,
        name,
      },
      subscription_data: {
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
          email,
        },
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('stripeCheckout error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});