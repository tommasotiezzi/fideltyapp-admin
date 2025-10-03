const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { planId, restaurantId } = req.body;

    const prices = {
      basic: 'price_1SEAd8JBeBAzL7Rp3mcoV0B7',
      premium: 'price_1SEAdXJBeBAzL7Rpgd1Np2jF',
    };

    const priceId = prices[planId];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${req.headers.origin}/dashboard?payment=success`,
      cancel_url: `${req.headers.origin}/dashboard?payment=cancelled`,
      metadata: { restaurantId, planId },
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};