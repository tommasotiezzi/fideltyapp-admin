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
      .select('stripe_customer_id, billing_type')
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

    if (!restaurant.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer ID found' });
    }

    console.log('Reporting usage to Stripe Billing Meters:', {
      customerId: restaurant.stripe_customer_id,
      quantity
    });

    // Use NEW Billing Meter Events API
    const stripeResponse = await fetch(
      'https://api.stripe.com/v1/billing/meter_events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          event_name: 'stamps_used',
          'payload[stripe_customer_id]': restaurant.stripe_customer_id,
          'payload[value]': quantity.toString(),
          timestamp: '1734480000',  // December 18, 2025 00:00:00 UTC

        })
      }
    );

    if (!stripeResponse.ok) {
      const error = await stripeResponse.json();
      console.error('Stripe API error:', error);
      return res.status(500).json({ error: 'Failed to report usage to Stripe', details: error });
    }

    const meterEvent = await stripeResponse.json();
    console.log('Meter event created:', meterEvent.identifier);

    res.status(200).json({ 
      success: true,
      meterEvent: {
        identifier: meterEvent.identifier,
        value: quantity
      }
    });

  } catch (error) {
    console.error('Report usage error:', error);
    res.status(500).json({ error: error.message });
  }
};
