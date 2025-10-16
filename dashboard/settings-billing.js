// settings-billing.js - Enhanced version with plan switching

class SettingsBillingManager {
    constructor() {
        this.restaurant = null;
        this.stripeSubscription = null;
        this.monthlyStamps = 0;
        this.init();
    }

    async init() {
        try {
            await this.loadRestaurantData();
            await this.displayBillingOverview();
            await this.loadAuthorizedEmails();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing settings:', error);
            this.showErrorState();
        }
    }

    async loadRestaurantData() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { data: restaurant } = await supabase
                .from('restaurants')
                .select('*')
                .eq('owner_id', user.id)
                .single();
            
            this.restaurant = restaurant;
            sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
            
            // IMPORTANT: Fetch subscription data FIRST before calculating stamps or displaying
            if (restaurant.stripe_subscription_id) {
                await this.fetchStripeSubscription();
            }
            
            // Calculate stamps given this billing cycle (for metered billing)
            if (restaurant.billing_type === 'metered') {
                await this.calculateMonthlyStamps();
            }
            
            this.updateRestaurantForm(restaurant);
            
        } catch (error) {
            console.error('Error loading restaurant data:', error);
        }
    }

    async calculateMonthlyStamps() {
        try {
            // Use Stripe's billing cycle start, or fallback to start of month
            let billingCycleStart;
            if (this.stripeSubscription?.current_period_start) {
                billingCycleStart = new Date(this.stripeSubscription.current_period_start * 1000);
            } else {
                // Fallback to start of current month if no Stripe data yet
                billingCycleStart = new Date();
                billingCycleStart.setDate(1);
                billingCycleStart.setHours(0, 0, 0, 0);
            }
            
            // First, get all customer_card IDs for this restaurant
            const { data: customerCards, error: cardsError } = await supabase
                .from('customer_cards')
                .select('id')
                .eq('restaurant_id', this.restaurant.id);
            
            if (cardsError) throw cardsError;
            
            if (!customerCards || customerCards.length === 0) {
                this.monthlyStamps = 0;
                return;
            }
            
            const cardIds = customerCards.map(card => card.id);
            
            // Get all stamps for those cards from current billing cycle
            const { data: stamps, error: stampsError } = await supabase
                .from('stamps')
                .select('stamps_given')
                .in('customer_card_id', cardIds)
                .gte('created_at', billingCycleStart.toISOString());
            
            if (stampsError) throw stampsError;
            
            this.monthlyStamps = stamps.reduce((sum, record) => sum + (record.stamps_given || 0), 0);
            
        } catch (error) {
            console.error('Error calculating monthly stamps:', error);
            this.monthlyStamps = 0;
        }
    }

    async fetchStripeSubscription() {
        try {
            const response = await fetch('/api/get-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: this.restaurant.stripe_subscription_id
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.stripeSubscription = data.subscription;
            }
        } catch (error) {
            console.error('Error fetching Stripe subscription:', error);
        }
    }

    updateRestaurantForm(restaurant) {
        const nameInput = document.getElementById('restaurant-name-input');
        const addressInput = document.getElementById('restaurant-address');
        const vatInput = document.getElementById('restaurant-vat');
        
        if (nameInput) nameInput.value = restaurant.name || '';
        if (addressInput) addressInput.value = restaurant.address || '';
        if (vatInput) vatInput.value = restaurant.vat_number || '';
    }

    async displayBillingOverview() {
        const billingOverview = document.querySelector('.billing-overview');
        if (!billingOverview) return;
        
        const tier = this.restaurant?.subscription_tier || 'free';
        const billingType = this.restaurant?.billing_type || 'monthly';
        const tierConfig = window.subscriptionManager?.getTierConfig() || {};
        
        const featureUsageHtml = await this.generateFeatureUsageHtml();
        const billingInfoHtml = this.generateBillingInfoHtml(tier, billingType, tierConfig);
        
        billingOverview.innerHTML = `
            ${featureUsageHtml}
            ${billingInfoHtml}
        `;
        
        await this.loadUsageData();
    }

    async generateFeatureUsageHtml() {
        const tier = this.restaurant?.subscription_tier || 'free';
        const tierConfig = window.subscriptionManager?.getTierConfig() || {};
        
        return `
            <div class="usage-overview-section">
                <h2>Your Usage This Month</h2>
                <div class="usage-grid">
                    <div class="usage-card">
                        <div class="usage-header">
                            <span class="usage-label">Loyalty Cards</span>
                            <span class="usage-count" id="cards-usage">Loading...</span>
                        </div>
                        <div class="usage-bar">
                            <div class="usage-progress" id="cards-progress"></div>
                        </div>
                        <span class="usage-limit">Live: <span id="cards-current">0</span> of ${tierConfig.maxLiveCards === 999 ? '∞' : tierConfig.maxLiveCards || 0}</span>
                    </div>
                    
                    <div class="usage-card">
                        <div class="usage-header">
                            <span class="usage-label">Promotions</span>
                            <span class="usage-count" id="promotions-usage">Loading...</span>
                        </div>
                        <div class="usage-bar">
                            <div class="usage-progress" id="promotions-progress"></div>
                        </div>
                        <span class="usage-limit">Active: <span id="promotions-current">0</span> of ${tierConfig.maxLivePromotions === 999 ? '∞' : tierConfig.maxLivePromotions || 0}</span>
                    </div>
                    
                    <div class="usage-card">
                        <div class="usage-header">
                            <span class="usage-label">Events</span>
                            <span class="usage-count" id="events-usage">Loading...</span>
                        </div>
                        <div class="usage-bar">
                            <div class="usage-progress" id="events-progress"></div>
                        </div>
                        <span class="usage-limit">Active: <span id="events-current">0</span> of ${tierConfig.maxLiveEvents === 999 ? '∞' : tierConfig.maxLiveEvents || 0}</span>
                    </div>
                    
                    <div class="usage-card">
                        <div class="usage-header">
                            <span class="usage-label">Push Notifications</span>
                            <span class="usage-count" id="notifications-usage">Loading...</span>
                        </div>
                        <div class="usage-bar">
                            <div class="usage-progress" id="notifications-progress"></div>
                        </div>
                        <span class="usage-limit">Sent: <span id="notifications-current">${this.restaurant?.notifications_sent_this_month || 0}</span> of ${tierConfig.maxNotificationsPerMonth === 999 ? '∞' : tierConfig.maxNotificationsPerMonth || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }

    generateBillingInfoHtml(tier, billingType, tierConfig) {
        const tierColors = {
            free: { bg: '#e5e7eb', text: '#4b5563' },
            basic: { bg: '#3b82f6', text: '#ffffff' },
            premium: { bg: '#8b5cf6', text: '#ffffff' }
        };
        
        const colors = tierColors[tier] || tierColors.free;
        
        // Pricing info
        const pricingInfo = {
            basic: {
                monthly: { fee: '9.90', activation: '29.90' },
                metered: { perStamp: '0.05', activation: '29.90' }
            },
            premium: {
                monthly: { fee: '14.90', activation: '49.90' },
                metered: { perStamp: '0.055', activation: '49.90' }
            }
        };
        
        const currentPricing = pricingInfo[tier]?.[billingType] || {};
        
        // Get data from Stripe subscription
        let nextBillingDate = 'N/A';
        let daysRemaining = 0;
        let isInTrial = false;
        let subscriptionStatus = 'active';
        let nextAmount = '0.00';

        if (this.stripeSubscription) {
            isInTrial = this.stripeSubscription.status === 'trialing';
            subscriptionStatus = this.stripeSubscription.status;
            
            // Use trial_end if in trial, otherwise use current_period_end
            const endTimestamp = this.stripeSubscription.current_period_end || this.stripeSubscription.trial_end;
            
            if (endTimestamp) {
                const endDate = new Date(endTimestamp * 1000);
                nextBillingDate = endDate.toLocaleDateString('en-GB', { 
                    day: 'numeric',
                    month: 'long', 
                    year: 'numeric'
                });
                daysRemaining = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            }
            
            // Calculate next amount based on billing type
            if (billingType === 'monthly') {
                nextAmount = currentPricing.fee || '0.00';
            } else if (billingType === 'metered') {
                // Estimate based on current billing cycle usage
                const estimatedStamps = this.monthlyStamps * 1.1; // 10% buffer
                nextAmount = (estimatedStamps * parseFloat(currentPricing.perStamp || 0)).toFixed(2);
            }
        }
        
        // Check for pending plan change
        const hasPendingChange = this.restaurant?.pending_plan_change;
        const pendingChangeDate = this.restaurant?.plan_change_effective_date;
        
        return `
            <div class="billing-info-section" style="background: linear-gradient(135deg, ${colors.bg}, ${this.adjustColor(colors.bg, -20)}); color: ${colors.text}; padding: 2rem; border-radius: 12px; margin-top: 2rem;">
                <div class="billing-header">
                    <div>
                        <h2 style="color: ${colors.text}; margin: 0;">${tierConfig.displayName || 'Free'} Plan</h2>
                        <p style="opacity: 0.9; margin: 0.5rem 0 0 0; font-size: 0.875rem;">
                            ${billingType === 'monthly' ? '💳 Fixed Monthly Billing - Unlimited Stamps' : '📊 Pay-Per-Stamp - Usage-Based Billing'}
                        </p>
                    </div>
                    <div class="plan-badge" style="background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600;">
                        ${tier.toUpperCase()}
                    </div>
                </div>
                
                ${hasPendingChange ? `
                    <div class="pending-change-alert" style="background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); padding: 1rem; border-radius: 8px; margin: 1.5rem 0;">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style="display: inline-block; vertical-align: middle; margin-right: 0.5rem;">
                            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span>Plan change scheduled: ${this.formatPendingChange(hasPendingChange)} on ${new Date(pendingChangeDate).toLocaleDateString('en-GB')}</span>
                    </div>
                ` : ''}
                
                ${tier !== 'free' ? `
                    <div class="billing-details-grid" style="display: grid; grid-template-columns: repeat(${billingType === 'metered' ? '4' : '3'}, 1fr); gap: 1rem; margin: 2rem 0;">
                        ${billingType === 'monthly' ? `
                            <div class="billing-detail-card" style="background: rgba(255,255,255,0.1); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                                <span class="billing-label" style="display: block; font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Monthly Fee</span>
                                <span class="billing-value" style="display: block; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem;">€${currentPricing.fee}</span>
                                <span class="billing-detail" style="display: block; font-size: 0.813rem; opacity: 0.8;">${isInTrial ? 'After trial period' : 'Per month'}</span>
                            </div>
                        ` : `
                            <div class="billing-detail-card" style="background: rgba(255,255,255,0.1); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                                <span class="billing-label" style="display: block; font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Rate Per Stamp</span>
                                <span class="billing-value" style="display: block; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem;">€${currentPricing.perStamp}</span>
                                <span class="billing-detail" style="display: block; font-size: 0.813rem; opacity: 0.8;">Pay as you go</span>
                            </div>
                            
                            <div class="billing-detail-card" style="background: rgba(255,255,255,0.1); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                                <span class="billing-label" style="display: block; font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Stamps This Cycle</span>
                                <span class="billing-value" style="display: block; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem;">${this.monthlyStamps.toLocaleString()}</span>
                                <span class="billing-detail" style="display: block; font-size: 0.813rem; opacity: 0.8;">€${(this.monthlyStamps * parseFloat(currentPricing.perStamp || 0)).toFixed(2)} cost</span>
                            </div>
                        `}
                        
                        <div class="billing-detail-card" style="background: rgba(255,255,255,0.1); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                            <span class="billing-label" style="display: block; font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Next Payment</span>
                            <span class="billing-value" style="display: block; font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; line-height: 1.2;">${nextBillingDate}</span>
                            <span class="billing-detail" style="display: block; font-size: 0.813rem; opacity: 0.8;">${daysRemaining} days remaining</span>
                        </div>
                        
                        <div class="billing-detail-card" style="background: rgba(255,255,255,0.1); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                            <span class="billing-label" style="display: block; font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Est. Next Bill</span>
                            <span class="billing-value" style="display: block; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem;">€${nextAmount}</span>
                            <span class="billing-detail" style="display: block; font-size: 0.813rem; opacity: 0.8;">${billingType === 'metered' ? 'Estimated' : 'Fixed amount'}</span>
                        </div>
                    </div>
                    
                    ${isInTrial ? `
                        <div class="trial-notice" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); padding: 1rem; border-radius: 8px; margin-top: 1.5rem;">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style="display: inline-block; vertical-align: middle; margin-right: 0.5rem;">
                                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span>Your 60-day included period is active. First billing on ${nextBillingDate}</span>
                        </div>
                    ` : ''}
                    
                    <div class="payment-method-section">
                        <h3 style="color: ${colors.text}; margin-top: 2rem;">Payment Method</h3>
                        ${this.stripeSubscription ? `
                            <div class="payment-method-card" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 1.5rem; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <p style="margin: 0 0 0.5rem 0; opacity: 0.9;">Card on file</p>
                                        <p style="margin: 0; font-size: 0.875rem; opacity: 0.7;">Managed securely by Stripe</p>
                                    </div>
                                    <button class="btn-manage-billing" onclick="settingsBilling.openBillingPortal()" style="background: rgba(255,255,255,0.95); color: ${colors.bg}; padding: 0.625rem 1.25rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                        Manage Payment
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="stripe-placeholder" style="background: rgba(255,255,255,0.1); border: 2px dashed rgba(255,255,255,0.3); padding: 2rem; border-radius: 8px; text-align: center;">
                                <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" style="opacity: 0.5; margin-bottom: 1rem;">
                                    <path d="M3 10h11v2H3v-2zm0 4h7v2H3v-2zm0-8h18v2H3V6zm14 12.59L14.41 16 19 11.41 21.59 14 19 16.59 16.41 14 14 16.59z"/>
                                </svg>
                                <p style="opacity: 0.8;">No payment method on file</p>
                            </div>
                        `}
                    </div>
                    
                    <div class="plan-actions" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.2); display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="btn-change-plan" onclick="settingsBilling.openPlanModal()" style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.95); color: ${colors.bg}; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">
                            ${hasPendingChange ? 'View Scheduled Change' : 'Change Plan'}
                        </button>
                        ${!hasPendingChange ? `
                            <button class="btn-cancel-plan" onclick="settingsBilling.confirmCancellation()" style="flex: 1; min-width: 200px; background: rgba(239, 68, 68, 0.15); color: rgba(255,255,255,0.95); padding: 0.75rem 1.5rem; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">
                                Cancel Subscription
                            </button>
                        ` : `
                            <button class="btn-cancel-change" onclick="settingsBilling.cancelPendingChange()" style="flex: 1; min-width: 200px; background: rgba(239, 68, 68, 0.15); color: rgba(255,255,255,0.95); padding: 0.75rem 1.5rem; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">
                                Cancel Scheduled Change
                            </button>
                        `}
                    </div>
                ` : `
                    <div class="free-plan-cta" style="margin-top: 2rem; text-align: center; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
                        <h3 style="color: ${colors.text}; margin-bottom: 1rem;">Upgrade to unlock more features</h3>
                        <button class="btn-upgrade" style="background: rgba(255,255,255,0.95); color: ${colors.bg}; padding: 0.75rem 2rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem;" onclick="settingsBilling.openPlanModal()">
                            View Plans
                        </button>
                    </div>
                `}
            </div>
        `;
    }

    formatPendingChange(changeString) {
        try {
            const parsed = JSON.parse(changeString);
            if (parsed.tier === 'free') return 'Cancellation';
            return `${parsed.tier.charAt(0).toUpperCase() + parsed.tier.slice(1)} (${parsed.billing_type === 'monthly' ? 'Fixed' : 'Pay-per-stamp'})`;
        } catch {
            return changeString;
        }
    }

    openPlanModal() {
        // Create backdrop
        const modal = document.createElement('div');
        modal.id = 'plan-change-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 1rem;';
        modal.innerHTML = this.generatePlanModalHtml();
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePlanModal();
            }
        });
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    generatePlanModalHtml() {
        const currentTier = this.restaurant?.subscription_tier || 'free';
        const currentBilling = this.restaurant?.billing_type || 'monthly';
        
        return `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto; background: white; border-radius: 12px; position: relative;">
                <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.5rem; color: #111827;">Change Your Plan</h2>
                    <button class="modal-close" onclick="settingsBilling.closePlanModal()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #6b7280; padding: 0.5rem; line-height: 1; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">×</button>
                </div>
                
                <div style="padding: 2rem;">
                    <p style="color: #6b7280; margin-bottom: 2rem;">Changes will take effect at your next billing cycle${this.stripeSubscription ? ` (${new Date(this.stripeSubscription.current_period_end * 1000).toLocaleDateString('en-GB')})` : ''}</p>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                        <!-- Basic Monthly -->
                        <div style="border: 2px solid ${currentTier === 'basic' && currentBilling === 'monthly' ? '#3b82f6' : '#e5e7eb'}; border-radius: 12px; padding: 1.5rem; position: relative;">
                            ${currentTier === 'basic' && currentBilling === 'monthly' ? '<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">CURRENT</div>' : ''}
                            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem;">Basic - Monthly</h3>
                            <div style="font-size: 2rem; font-weight: 700; color: #3b82f6; margin-bottom: 0.5rem;">€9.90<span style="font-size: 1rem; font-weight: 400; color: #6b7280;">/mo</span></div>
                            <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">Unlimited stamps</p>
                            <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; font-size: 0.875rem;">
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 1 loyalty card</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 3 promotions</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 2 events</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 2 notifications/month</li>
                            </ul>
                            ${currentTier === 'basic' && currentBilling === 'monthly' ? '' : `
                                <button onclick="settingsBilling.selectNewPlan('basic', 'monthly')" style="width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Select Plan</button>
                            `}
                        </div>
                        
                        <!-- Basic Metered -->
                        <div style="border: 2px solid ${currentTier === 'basic' && currentBilling === 'metered' ? '#3b82f6' : '#e5e7eb'}; border-radius: 12px; padding: 1.5rem; position: relative;">
                            ${currentTier === 'basic' && currentBilling === 'metered' ? '<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">CURRENT</div>' : ''}
                            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem;">Basic - Pay-Per-Stamp</h3>
                            <div style="font-size: 2rem; font-weight: 700; color: #3b82f6; margin-bottom: 0.5rem;">€0.05<span style="font-size: 1rem; font-weight: 400; color: #6b7280;">/stamp</span></div>
                            <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">Pay as you go</p>
                            <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; font-size: 0.875rem;">
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 1 loyalty card</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 3 promotions</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 2 events</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 2 notifications/month</li>
                            </ul>
                            ${currentTier === 'basic' && currentBilling === 'metered' ? '' : `
                                <button onclick="settingsBilling.selectNewPlan('basic', 'metered')" style="width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Select Plan</button>
                            `}
                        </div>
                        
                        <!-- Premium Monthly -->
                        <div style="border: 2px solid ${currentTier === 'premium' && currentBilling === 'monthly' ? '#8b5cf6' : '#e5e7eb'}; border-radius: 12px; padding: 1.5rem; position: relative;">
                            ${currentTier === 'premium' && currentBilling === 'monthly' ? '<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #8b5cf6; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">CURRENT</div>' : ''}
                            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem;">Premium - Monthly</h3>
                            <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6; margin-bottom: 0.5rem;">€14.90<span style="font-size: 1rem; font-weight: 400; color: #6b7280;">/mo</span></div>
                            <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">Unlimited stamps</p>
                            <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; font-size: 0.875rem;">
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 3 loyalty cards</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 9 promotions</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 6 events</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 6 notifications/month</li>
                            </ul>
                            ${currentTier === 'premium' && currentBilling === 'monthly' ? '' : `
                                <button onclick="settingsBilling.selectNewPlan('premium', 'monthly')" style="width: 100%; padding: 0.75rem; background: #8b5cf6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Select Plan</button>
                            `}
                        </div>
                        
                        <!-- Premium Metered -->
                        <div style="border: 2px solid ${currentTier === 'premium' && currentBilling === 'metered' ? '#8b5cf6' : '#e5e7eb'}; border-radius: 12px; padding: 1.5rem; position: relative;">
                            ${currentTier === 'premium' && currentBilling === 'metered' ? '<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #8b5cf6; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">CURRENT</div>' : ''}
                            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem;">Premium - Pay-Per-Stamp</h3>
                            <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6; margin-bottom: 0.5rem;">€0.055<span style="font-size: 1rem; font-weight: 400; color: #6b7280;">/stamp</span></div>
                            <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">Pay as you go</p>
                            <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; font-size: 0.875rem;">
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 3 loyalty cards</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 9 promotions</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 6 events</li>
                                <li style="padding: 0.4rem 0; color: #374151;">✓ 6 notifications/month</li>
                            </ul>
                            ${currentTier === 'premium' && currentBilling === 'metered' ? '' : `
                                <button onclick="settingsBilling.selectNewPlan('premium', 'metered')" style="width: 100%; padding: 0.75rem; background: #8b5cf6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Select Plan</button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    closePlanModal() {
        const modal = document.getElementById('plan-change-modal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = '';
        }
    }

    async selectNewPlan(tier, billingType) {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;';
        confirmModal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 400px; margin: 1rem;">
                <h3 style="margin: 0 0 1rem 0; color: #111827;">Confirm Plan Change</h3>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280;">Switch to ${tier.charAt(0).toUpperCase() + tier.slice(1)} (${billingType === 'monthly' ? 'Fixed Monthly' : 'Pay-Per-Stamp'})?</p>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280; font-size: 0.875rem;">This change will take effect at your next billing cycle.</p>
                <div style="display: flex; gap: 0.75rem;">
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 0.625rem 1rem; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Cancel</button>
                    <button id="confirm-plan-change" style="flex: 1; padding: 0.625rem 1rem; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        document.getElementById('confirm-plan-change').onclick = async () => {
            confirmModal.remove();
            
            try {
                const response = await fetch('/api/update-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: this.restaurant.id,
                        newTier: tier,
                        newBillingType: billingType
                    })
                });

                if (!response.ok) throw new Error('Failed to update subscription');

                this.showCustomAlert('Plan change scheduled successfully! Changes will apply at your next billing cycle.', 'success');
                this.closePlanModal();
                
                setTimeout(() => location.reload(), 2000);

            } catch (error) {
                console.error('Error updating plan:', error);
                this.showCustomAlert('Failed to update plan. Please try again or contact support.', 'error');
            }
        };
    }

    async confirmCancellation() {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;';
        confirmModal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 400px; margin: 1rem;">
                <h3 style="margin: 0 0 1rem 0; color: #111827;">Cancel Subscription?</h3>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280;">Are you sure you want to cancel your subscription?</p>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280; font-size: 0.875rem;">You will retain access until the end of your current billing period, after which your account will be downgraded to the Free plan.</p>
                <div style="display: flex; gap: 0.75rem;">
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 0.625rem 1rem; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Keep Subscription</button>
                    <button id="confirm-cancellation" style="flex: 1; padding: 0.625rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Cancel Subscription</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        document.getElementById('confirm-cancellation').onclick = async () => {
            confirmModal.remove();
            
            try {
                const response = await fetch('/api/update-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: this.restaurant.id,
                        newTier: 'free',
                        newBillingType: 'monthly'
                    })
                });

                if (!response.ok) throw new Error('Failed to cancel subscription');

                this.showCustomAlert('Subscription cancelled. You will retain access until the end of your current billing period.', 'success');
                
                setTimeout(() => location.reload(), 2000);

            } catch (error) {
                console.error('Error cancelling subscription:', error);
                this.showCustomAlert('Failed to cancel subscription. Please try again or contact support.', 'error');
            }
        };
    }

    async cancelPendingChange() {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;';
        confirmModal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 400px; margin: 1rem;">
                <h3 style="margin: 0 0 1rem 0; color: #111827;">Cancel Scheduled Change?</h3>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280;">This will cancel your scheduled plan change.</p>
                <div style="display: flex; gap: 0.75rem;">
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex: 1; padding: 0.625rem 1rem; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Keep Change</button>
                    <button id="confirm-cancel-change" style="flex: 1; padding: 0.625rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Cancel Change</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        document.getElementById('confirm-cancel-change').onclick = async () => {
            confirmModal.remove();
            
            try {
                const response = await fetch('/api/cancel-pending-change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: this.restaurant.id
                    })
                });

                if (!response.ok) throw new Error('Failed to cancel pending change');

                this.showCustomAlert('Scheduled plan change cancelled.', 'success');
                
                setTimeout(() => location.reload(), 2000);

            } catch (error) {
                console.error('Error cancelling pending change:', error);
                this.showCustomAlert('Failed to cancel pending change. Please try again.', 'error');
            }
        };
    }

    showCustomAlert(message, type = 'success') {
        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed; 
            top: 20px; 
            right: 20px; 
            padding: 1rem 1.5rem; 
            background: ${type === 'success' ? '#10b981' : '#ef4444'}; 
            color: white; 
            border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
            z-index: 10002;
            font-size: 14px;
            max-width: 350px;
        `;
        alert.textContent = message;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 4000);
    }

    async openBillingPortal() {
        try {
            if (!this.restaurant?.stripe_customer_id) {
                this.showCustomAlert('No payment method on file. Please contact support.', 'error');
                return;
            }

            const response = await fetch('/api/create-billing-portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: this.restaurant.stripe_customer_id,
                    returnUrl: window.location.href
                })
            });

            const data = await response.json();

            if (response.ok && data.url) {
                window.location.href = data.url;
            } else {
                this.showCustomAlert(`Unable to open billing portal: ${data.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error opening billing portal:', error);
            this.showCustomAlert('Error opening billing portal: ' + error.message, 'error');
        }
    }

    async loadAuthorizedEmails() {
        try {
            const { data } = await supabase
                .from('restaurants')
                .select('authorized_emails')
                .eq('id', this.restaurant.id)
                .single();
            
            const emails = data?.authorized_emails || [];
            const staffList = document.querySelector('.staff-list');
            
            if (staffList) {
                staffList.innerHTML = '';
                if (emails.length > 0) {
                    emails.forEach(email => this.addEmailToUI(email));
                } else {
                    staffList.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">No staff members authorized yet</p>';
                }
            }
            
        } catch (error) {
            console.error('Error loading authorized emails:', error);
        }
    }

    addEmailToUI(email) {
        const staffList = document.querySelector('.staff-list');
        if (!staffList) return;
        
        const staffItem = document.createElement('div');
        staffItem.className = 'staff-item';
        staffItem.innerHTML = `
            <div class="staff-info">
                <span class="staff-email">${email}</span>
                <span class="staff-badge">Can validate stamps</span>
            </div>
            <button class="remove-staff" onclick="settingsBilling.removeEmail('${email}')">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;
        
        staffList.appendChild(staffItem);
    }

    async addAuthorizedEmail() {
        const emailInput = document.getElementById('new-staff-email');
        const email = emailInput?.value.trim();
        
        if (!email || !this.validateEmail(email)) {
            this.showCustomAlert('Please enter a valid email address', 'error');
            return;
        }
        
        try {
            const { data: current } = await supabase
                .from('restaurants')
                .select('authorized_emails')
                .eq('id', this.restaurant.id)
                .single();
            
            const emails = current?.authorized_emails || [];
            
            if (emails.includes(email)) {
                this.showCustomAlert('This email is already authorized', 'error');
                return;
            }
            
            emails.push(email);
            
            const { error } = await supabase
                .from('restaurants')
                .update({ authorized_emails: emails })
                .eq('id', this.restaurant.id);
            
            if (error) throw error;
            
            this.addEmailToUI(email);
            emailInput.value = '';
            
            this.showCustomAlert(`${email} is now authorized to validate stamps.`, 'success');
            
        } catch (error) {
            console.error('Error adding authorized email:', error);
            this.showCustomAlert('Error authorizing email', 'error');
        }
    }

    async removeEmail(email) {
        if (!confirm(`Remove ${email} from authorized stamp validators?`)) return;
        
        try {
            const { data: current } = await supabase
                .from('restaurants')
                .select('authorized_emails')
                .eq('id', this.restaurant.id)
                .single();
            
            const emails = (current?.authorized_emails || []).filter(e => e !== email);
            
            const { error } = await supabase
                .from('restaurants')
                .update({ authorized_emails: emails })
                .eq('id', this.restaurant.id);
            
            if (error) throw error;
            
            await this.loadAuthorizedEmails();
            
        } catch (error) {
            console.error('Error removing email:', error);
            this.showCustomAlert('Error removing authorization', 'error');
        }
    }

    async loadUsageData() {
        try {
            const tierConfig = window.subscriptionManager?.getTierConfig() || {};
            
            const { data: cards } = await supabase
                .from('loyalty_cards')
                .select('id')
                .eq('restaurant_id', this.restaurant.id)
                .eq('campaign_status', 'live')
                .is('deleted_at', null);
            
            const { data: promotions } = await supabase
                .from('promotions')
                .select('id')
                .eq('restaurant_id', this.restaurant.id)
                .eq('status', 'active');
            
            const today = new Date().toISOString().split('T')[0];
            const { data: events } = await supabase
                .from('events')
                .select('id')
                .eq('restaurant_id', this.restaurant.id)
                .eq('status', 'active')
                .gte('event_date', today);
            
            this.updateUsageDisplay('cards', cards?.length || 0, tierConfig.maxLiveCards);
            this.updateUsageDisplay('promotions', promotions?.length || 0, tierConfig.maxLivePromotions);
            this.updateUsageDisplay('events', events?.length || 0, tierConfig.maxLiveEvents);
            this.updateUsageDisplay('notifications', this.restaurant.notifications_sent_this_month || 0, tierConfig.maxNotificationsPerMonth);
            
        } catch (error) {
            console.error('Error loading usage:', error);
        }
    }

    updateUsageDisplay(feature, current, limit) {
        const percentage = limit === 999 ? 0 : (current / limit * 100);
        
        const currentEl = document.getElementById(`${feature}-current`);
        const progressEl = document.getElementById(`${feature}-progress`);
        const usageEl = document.getElementById(`${feature}-usage`);
        
        if (currentEl) currentEl.textContent = current;
        if (progressEl) {
            progressEl.style.width = `${Math.min(percentage, 100)}%`;
            progressEl.style.background = percentage >= 100 ? '#ef4444' : 
                                         percentage >= 80 ? '#f59e0b' : '#7c5ce6';
        }
        if (usageEl) {
            if (percentage >= 100) {
                usageEl.textContent = 'Limit Reached';
                usageEl.style.color = '#ef4444';
            } else if (percentage >= 80) {
                usageEl.textContent = `${Math.round(100 - percentage)}% left`;
                usageEl.style.color = '#f59e0b';
            } else {
                usageEl.textContent = `${current} used`;
                usageEl.style.color = '#10b981';
            }
        }
    }

    adjustColor(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return (usePound ? '#' : '') + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    setupEventListeners() {
        const addStaffBtn = document.querySelector('.btn-add');
        if (addStaffBtn) {
            addStaffBtn.onclick = () => this.addAuthorizedEmail();
        }
        
        const updateBtn = document.querySelector('.btn-update-restaurant');
        if (updateBtn) {
            updateBtn.onclick = () => this.updateRestaurantInfo();
        }
    }

    async updateRestaurantInfo() {
        const nameInput = document.getElementById('restaurant-name-input');
        const addressInput = document.getElementById('restaurant-address');
        const vatInput = document.getElementById('restaurant-vat');
        
        try {
            const { error } = await supabase
                .from('restaurants')
                .update({
                    name: nameInput.value,
                    address: addressInput.value,
                    vat_number: vatInput.value
                })
                .eq('id', this.restaurant.id);
            
            if (error) throw error;
            
            this.restaurant.name = nameInput.value;
            this.restaurant.address = addressInput.value;
            this.restaurant.vat_number = vatInput.value;
            sessionStorage.setItem('restaurant', JSON.stringify(this.restaurant));
            
            this.showCustomAlert('Restaurant information updated successfully', 'success');
            
        } catch (error) {
            console.error('Error updating restaurant:', error);
            this.showCustomAlert('Error updating restaurant information', 'error');
        }
    }

    showErrorState() {
        const container = document.querySelector('.settings-grid');
        if (container) {
            container.innerHTML = `
                <div class="settings-card">
                    <h2>Error Loading Settings</h2>
                    <p>Unable to load settings. Please refresh the page.</p>
                    <button class="btn-primary" onclick="location.reload()">Refresh</button>
                </div>
            `;
        }
    }
}

// Initialize and export
const settingsBilling = new SettingsBillingManager();
window.settingsBilling = settingsBilling;
