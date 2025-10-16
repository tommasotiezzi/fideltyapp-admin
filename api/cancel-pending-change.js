// api/cancel-pending-change.js
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
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Missing restaurantId' });
    }

    // Get restaurant data
    const { data: restaurant, error: dbError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (dbError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (!restaurant.pending_plan_change) {
      return res.status(400).json({ error: 'No pending plan change found' });
    }

    if (!restaurant.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(restaurant.stripe_subscription_id);

    // Check if it was a cancellation
    const pendingChange = JSON.parse(restaurant.pending_plan_change);
    if (pendingChange.tier === 'free') {
      // Reactivate subscription
      await stripe.subscriptions.update(restaurant.stripe_subscription_id, {
        cancel_at_period_end: false
      });
    } else {
      // Revert to current plan
      // Get the current price based on restaurant's tier and billing type
      const STRIPE_PRICES = {
        basic: {
          monthly: 'price_1SEAhZJBeBAzL7Rp3bhblPJG',
          metered: 'price_1SIn0XJBeBAzL7Rp40cecUXX'
        },
        premium: {
          monthly: 'price_1SEAhJJBeBAzL7RplovGzWXL',
          metered: 'price_1SImzyJBeBAzL7RphdP9FhQP'
        }
      };

      const currentPriceId = STRIPE_PRICES[restaurant.subscription_tier]?.[restaurant.billing_type];
      
      if (currentPriceId) {
        await stripe.subscriptions.update(
          restaurant.stripe_subscription_id,
          {
            items: [
              {
                id: subscription.items.data[0].id,
                price: currentPriceId
              }
            ],
            proration_behavior: 'none'
          }
        );
      }
    }

    // Clear pending change in database
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        pending_plan_change: null,
        plan_change_effective_date: null
      })
      .eq('id', restaurantId);

    if (updateError) throw updateError;

    res.status(200).json({ 
      success: true,
      message: 'Pending plan change cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel pending change error:', error);
    res.status(500).json({ error: error.message });
  }
};
