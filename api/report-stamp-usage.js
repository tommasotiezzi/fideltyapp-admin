const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

    // Debug logging
    console.log('About to report usage:', {
      itemId: restaurant.stripe_metered_item_id,
      quantity,
      stripeExists: !!stripe,
      subscriptionItemsExists: !!stripe.subscriptionItems
    });

    // Report usage to Stripe - use correct syntax
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      restaurant.stripe_metered_item_id,
      {
        quantity: quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment'
      }
    );

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
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};
