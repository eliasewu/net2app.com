import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const VALID_PRICE_IDS = [
  'price_1TQcVsDAKyH5C0WbwtITowJL', // Starter $199/mo
  'price_1TQcVsDAKyH5C0Wbz151ecM5', // Professional $799/mo
  'price_1TQcVsDAKyH5C0WbNScSI3Rq', // Enterprise $2499/mo
];

Deno.serve(async (req) => {
  try {
    const { priceId, successUrl, cancelUrl } = await req.json();

    if (!priceId || !VALID_PRICE_IDS.includes(priceId)) {
      return Response.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.get('origin')}/billing?success=1`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/billing?cancelled=1`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
      },
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});