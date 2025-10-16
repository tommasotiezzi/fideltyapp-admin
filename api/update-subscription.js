// api/update-subscription.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Stripe Product/Price mapping
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { restaurantId, newTier, newBillingType } = req.body;

    if (!restaurantId || !newTier || !newBillingType) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    if (!restaurant.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(restaurant.stripe_subscription_id);

    // Handle cancellation (downgrade to free)
    if (newTier === 'free') {
      // Cancel at period end
      await stripe.subscriptions.update(restaurant.stripe_subscription_id, {
        cancel_at_period_end: true
      });

      // Update database with pending change
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          pending_plan_change: JSON.stringify({ tier: 'free', billing_type: 'monthly' }),
          plan_change_effective_date: new Date(subscription.current_period_end * 1000).toISOString()
        })
        .eq('id', restaurantId);

      if (updateError) throw updateError;

      return res.status(200).json({ 
        success: true, 
        message: 'Subscription will be cancelled at period end' 
      });
    }

    // Get new Stripe price ID
    const newPriceId = STRIPE_PRICES[newTier]?.[newBillingType];
    if (!newPriceId) {
      return res.status(400).json({ error: 'Invalid plan configuration' });
    }

    // Update subscription with new plan (applies at next billing cycle)
    const updatedSubscription = await stripe.subscriptions.update(
      restaurant.stripe_subscription_id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId
          }
        ],
        proration_behavior: 'none', // No prorations, change at next cycle
        cancel_at_period_end: false // Ensure subscription continues
      }
    );

    // Get the new subscription item ID (for metered billing)
    const newSubscriptionItemId = updatedSubscription.items.data[0].id;

    // Update database with pending change
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        pending_plan_change: JSON.stringify({ tier: newTier, billing_type: newBillingType }),
        plan_change_effective_date: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_metered_item_id: newBillingType === 'metered' ? newSubscriptionItemId : null
      })
      .eq('id', restaurantId);

    if (updateError) throw updateError;

    res.status(200).json({ 
      success: true,
      effectiveDate: new Date(subscription.current_period_end * 1000).toISOString(),
      newPlan: { tier: newTier, billingType: newBillingType }
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: error.message });
  }
};
