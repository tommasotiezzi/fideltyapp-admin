const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { restaurantId, quantity } = req.body;

    if (!restaurantId || !quantity) {
      return res.status(400).json({ error: 'Missing restaurantId or quantity' });
    }

    // Get restaurant's billing info
    const { data: restaurant, error: dbError } = await supabase
      .from('restaurants')
      .select('stripe_metered_item_id, billing_type, stripe_customer_id')
      .eq('id', restaurantId)
      .single();

    if (dbError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Only track usage for metered billing customers
    if (restaurant.billing_type !== 'metered') {
      return res.status(200).json({ 
        success: true, 
        message: 'No usage tracking needed for monthly billing'
      });
    }

    if (!restaurant.stripe_metered_item_id) {
      return res.status(400).json({ error: 'No metered billing configured' });
    }

    console.log('Reporting usage to Stripe:', {
      itemId: restaurant.stripe_metered_item_id,
      quantity
    });

    // Use Stripe HTTP API directly instead of SDK
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/subscription_items/${restaurant.stripe_metered_item_id}/usage_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          quantity: quantity.toString(),
          timestamp: Math.floor(Date.now() / 1000).toString(),
          action: 'increment'
        })
      }
    );

    if (!stripeResponse.ok) {
      const error = await stripeResponse.json();
      console.error('Stripe API error:', error);
      return res.status(500).json({ error: 'Failed to report usage to Stripe', details: error });
    }

    const usageRecord = await stripeResponse.json();
    console.log('Usage record created:', usageRecord.id);

    res.status(200).json({ 
      success: true,
      usageRecord: {
        id: usageRecord.id,
        quantity: usageRecord.quantity
      }
    });

  } catch (error) {
    console.error('Report usage error:', error);
    res.status(500).json({ error: error.message });
  }
};
