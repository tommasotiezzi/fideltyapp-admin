const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { planId, restaurantId } = req.body;

    const plans = {
      basic: {
        activation: 'price_1SEAd8JBeBAzL7Rp3mcoV0B7',
        recurring: 'price_1SEAhZJBeBAzL7Rp3bhblPJG'
      },
      premium: {
        activation: 'price_1SEAdXJBeBAzL7Rpgd1Np2jF',
        recurring: 'price_1SEAhJJBeBAzL7RplovGzWXL'
      }
    };

    const plan = plans[planId];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    // One-time payment for activation fee
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: plan.activation, quantity: 1 }],
      payment_intent_data: {
        setup_future_usage: 'off_session' // Save payment method for future use
      },
      success_url: `${req.headers.origin}/dashboard?payment=success`,
      cancel_url: `${req.headers.origin}/dashboard?payment=cancelled`,
      metadata: { restaurantId, planId, recurringPrice: plan.recurring }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
};
