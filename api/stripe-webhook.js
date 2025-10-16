const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Map Stripe price IDs to plan configuration
const PRICE_TO_PLAN = {
  'price_1SEAhZJBeBAzL7Rp3bhblPJG': { tier: 'basic', billing: 'monthly' },
  'price_1SIn0XJBeBAzL7Rp40cecUXX': { tier: 'basic', billing: 'metered' },
  'price_1SEAhJJBeBAzL7RplovGzWXL': { tier: 'premium', billing: 'monthly' },
  'price_1SImzyJBeBAzL7RphdP9FhQP': { tier: 'premium', billing: 'metered' }
};

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

  // Activation fee paid successfully
  if (event.type === 'checkout.session.completed' && event.data.object.mode === 'payment') {
    const session = event.data.object;
    const { restaurantId, planId, billingType, recurringPrice, meteredPrice } = session.metadata;

    console.log('Activation fee paid:', { restaurantId, planId, billingType });

    if (restaurantId && (recurringPrice || meteredPrice)) {
      try {
        // Get or create customer
        let customerId = session.customer;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: session.customer_details?.email,
            metadata: { restaurantId }
          });
          customerId = customer.id;
        }

        // Create subscription that starts in 60 days
        const trialEnd = Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60);
        
        // Build subscription items based on billing type
        const subscriptionItems = [];
        if (billingType === 'monthly' && recurringPrice) {
          subscriptionItems.push({ price: recurringPrice });
        } else if (billingType === 'metered' && meteredPrice) {
          subscriptionItems.push({ price: meteredPrice });
        }

        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: subscriptionItems,
          trial_end: trialEnd,
          metadata: { restaurantId, planId, billingType }
        });

        console.log('Subscription created:', subscription.id);

        // Find metered item ID if applicable
        let meteredItemId = null;
        if (billingType === 'metered') {
          const meteredItem = subscription.items.data.find(
            item => item.price.id === meteredPrice
          );
          meteredItemId = meteredItem?.id;
        }

        // Update database
        await supabase
          .from('restaurants')
          .update({
            subscription_status: 'active',
            subscription_tier: planId,
            billing_type: billingType,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_metered_item_id: meteredItemId,
            activation_fee_paid: true
          })
          .eq('id', restaurantId);

      } catch (error) {
        console.error('Error creating subscription:', error);
      }
    }
  }

  // Subscription status changes
  // UPDATED: Now handles plan changes when Stripe applies them
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    
    try {
      // Get current restaurant data
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('subscription_tier, billing_type')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (!restaurant) {
        console.error('Restaurant not found for subscription:', subscription.id);
        await supabase
          .from('restaurants')
          .update({ subscription_status: subscription.status })
          .eq('stripe_subscription_id', subscription.id);
        return res.json({ received: true });
      }

      // NEW: Detect if plan changed by checking Stripe's current price
      const currentPriceId = subscription.items.data[0]?.price?.id;
      const newPlan = PRICE_TO_PLAN[currentPriceId];

      // Check if plan actually changed
      const planChanged = newPlan && (
        restaurant.subscription_tier !== newPlan.tier ||
        restaurant.billing_type !== newPlan.billing
      );

      if (planChanged) {
        console.log(`Plan changed from ${restaurant.subscription_tier}/${restaurant.billing_type} to ${newPlan.tier}/${newPlan.billing}`);
        
        // Get new metered item ID if switching to metered
        const meteredItemId = newPlan.billing === 'metered' 
          ? subscription.items.data[0].id 
          : null;

        // Update to new plan
        await supabase
          .from('restaurants')
          .update({
            subscription_status: subscription.status,
            subscription_tier: newPlan.tier,
            billing_type: newPlan.billing,
            stripe_metered_item_id: meteredItemId,
            pending_plan_change: null,  // Clear pending change
            plan_change_effective_date: null
          })
          .eq('stripe_subscription_id', subscription.id);
      } else {
        // No plan change, just update status
        await supabase
          .from('restaurants')
          .update({ subscription_status: subscription.status })
          .eq('stripe_subscription_id', subscription.id);
      }

      // NEW: Track if subscription is set to cancel at period end
      if (subscription.cancel_at_period_end) {
        await supabase
          .from('restaurants')
          .update({
            pending_plan_change: JSON.stringify({ tier: 'free', billing_type: 'monthly' }),
            plan_change_effective_date: new Date(subscription.current_period_end * 1000).toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
      }

    } catch (error) {
      console.error('Error handling subscription update:', error);
    }
  }

  // Payment failed
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    
    await supabase
      .from('restaurants')
      .update({ subscription_status: 'past_due' })
      .eq('stripe_customer_id', invoice.customer);
  }

  // Subscription deleted/cancelled
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    
    await supabase
      .from('restaurants')
      .update({ 
        subscription_status: 'cancelled',
        subscription_tier: 'free',
        billing_type: 'monthly',  // Reset to default
        stripe_subscription_id: null,
        stripe_metered_item_id: null,
        pending_plan_change: null,  // Clear any pending changes
        plan_change_effective_date: null
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  res.json({ received: true });
};
