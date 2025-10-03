const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const getRawBody = (req) => {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => { resolve(Buffer.from(data)); });
  });
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { restaurantId, planId } = session.metadata;

    if (restaurantId && planId) {
      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 2);

      await supabase
        .from('restaurants')
        .update({
          subscription_status: 'active',
          subscription_tier: planId,
          subscription_ends_at: subscriptionEndsAt.toISOString(),
          stripe_session_id: session.id,
        })
        .eq('id', restaurantId);
    }
  }

  res.json({ received: true });
};