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
    const { restaurantId, planId, recurringPrice } = session.metadata;

    console.log('Activation fee paid:', { restaurantId, planId, amount: session.amount_total });

    if (restaurantId && recurringPrice) {
      try {
        // Get the PaymentIntent to access the payment method
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        const paymentMethodId = paymentIntent.payment_method;

        console.log('Payment method ID:', paymentMethodId);

        // Get or create customer
        let customerId = session.customer;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: session.customer_details?.email,
            payment_method: paymentMethodId,
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
            metadata: { restaurantId }
          });
          customerId = customer.id;
          console.log('New customer created:', customerId);
        } else {
          // Attach the payment method to the existing customer
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
          });
          
          // Set it as the default payment method
          await stripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
          console.log('Payment method attached to existing customer:', customerId);
        }

        // Create an invoice item for the activation fee
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: session.amount_total,
          currency: session.currency || 'eur',
          description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - Activation Fee (Includes 60 days)`,
        });

        console.log('Invoice item created for activation fee');

        // Create and finalize an invoice for the activation fee
        const activationInvoice = await stripe.invoices.create({
          customer: customerId,
          auto_advance: false,
          collection_method: 'charge_automatically',
          description: 'Activation Fee - 60 Days Included',
        });

        console.log('Activation invoice created:', activationInvoice.id);

        // Mark it as paid since they already paid via Checkout
        await stripe.invoices.pay(activationInvoice.id, {
          paid_out_of_band: true,
        });

        console.log('Activation invoice marked as paid');

        // Now create subscription that starts in 60 days
        const trialEnd = Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60);
        
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: recurringPrice }],
          trial_end: trialEnd,
          metadata: { restaurantId, planId }
        });

        console.log('Subscription created:', subscription.id);

        // Update database
        await supabase
          .from('restaurants')
          .update({
            subscription_status: 'active',
            subscription_tier: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            activation_fee_paid: true
          })
          .eq('id', restaurantId);

        console.log('Database updated for restaurant:', restaurantId);

      } catch (error) {
        console.error('Error creating subscription:', error);
        console.error('Error details:', error.message);
      }
    }
  }

  // Subscription status changes
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    
    console.log('Subscription updated:', subscription.id, 'Status:', subscription.status);
    
    await supabase
      .from('restaurants')
      .update({ subscription_status: subscription.status })
      .eq('stripe_subscription_id', subscription.id);
  }

  // Payment failed
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    
    console.log('Payment failed for customer:', invoice.customer);
    
    await supabase
      .from('restaurants')
      .update({ subscription_status: 'past_due' })
      .eq('stripe_customer_id', invoice.customer);
  }

  // Subscription deleted/cancelled
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    
    console.log('Subscription cancelled:', subscription.id);
    
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
