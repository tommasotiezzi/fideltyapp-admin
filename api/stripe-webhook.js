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
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    
    await supabase
      .from('restaurants')
      .update({ subscription_status: subscription.status })
      .eq('stripe_subscription_id', subscription.id);
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
        subscription_tier: 'free'
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  res.json({ received: true });
};
