// settings-billing.js - Fetch subscription data from Stripe API

class SettingsBillingManager {
    constructor() {
        this.restaurant = null;
        this.stripeSubscription = null;
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
            
            // Fetch subscription data from Stripe if subscription exists
            if (restaurant.stripe_subscription_id) {
                await this.fetchStripeSubscription();
            }
            
            this.updateRestaurantForm(restaurant);
            
        } catch (error) {
            console.error('Error loading restaurant data:', error);
        }
    }

    async fetchStripeSubscription() {
        try {
            // Call your backend API to get subscription from Stripe
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
        
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        const tierConfig = window.subscriptionManager?.getTierConfig() || {};
        
        const featureUsageHtml = await this.generateFeatureUsageHtml();
        const billingInfoHtml = this.generateBillingInfoHtml(tier, tierConfig);
        
        billingOverview.innerHTML = `
            ${featureUsageHtml}
            ${billingInfoHtml}
        `;
        
        await this.loadUsageData();
    }

    async generateFeatureUsageHtml() {
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
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

    generateBillingInfoHtml(tier, tierConfig) {
        const tierColors = {
            free: { bg: '#e5e7eb', text: '#4b5563' },
            basic: { bg: '#3b82f6', text: '#ffffff' },
            premium: { bg: '#8b5cf6', text: '#ffffff' },
            enterprise: { bg: '#f59e0b', text: '#ffffff' }
        };
        
        const colors = tierColors[tier] || tierColors.free;
        
        // Get data from Stripe subscription
        let nextBillingDate = 'N/A';
        let daysRemaining = 0;
        let isInTrial = false;
        let subscriptionStatus = 'active';

        if (this.stripeSubscription) {
            const currentPeriodEnd = new Date(this.stripeSubscription.current_period_end * 1000);
            nextBillingDate = currentPeriodEnd.toLocaleDateString();
            daysRemaining = Math.ceil((currentPeriodEnd - new Date()) / (1000 * 60 * 60 * 24));
            isInTrial = this.stripeSubscription.status === 'trialing';
            subscriptionStatus = this.stripeSubscription.status;
        }
        
        return `
            <div class="billing-info-section" style="background: linear-gradient(135deg, ${colors.bg}, ${this.adjustColor(colors.bg, -20)}); color: ${colors.text}; padding: 2rem; border-radius: 12px; margin-top: 2rem;">
                <div class="billing-header">
                    <div>
                        <h2 style="color: ${colors.text}; margin: 0;">${tierConfig.displayName || 'Free'} Plan</h2>
                        <p style="opacity: 0.9; margin: 0.5rem 0;">
                            ${tier === 'free' ? 'Explore Tessere with limited features' :
                              tier === 'basic' ? 'Perfect for small restaurants' :
                              tier === 'premium' ? 'Full-featured for growing businesses' :
                              'Unlimited everything with dedicated support'}
                        </p>
                    </div>
                    <div class="plan-badge" style="background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600;">
                        ${tier.toUpperCase()}
                    </div>
                </div>
                
                ${tier !== 'free' ? `
                    <div class="billing-details-grid">
                        <div class="billing-detail-card">
                            <span class="billing-label">Monthly Fee</span>
                            <span class="billing-value">€${tierConfig.monthlyFee || 0}</span>
                            <span class="billing-detail">${isInTrial ? 'Currently in included period' : 'Per month'}</span>
                        </div>
                        
                        <div class="billing-detail-card">
                            <span class="billing-label">Next Payment</span>
                            <span class="billing-value">${nextBillingDate}</span>
                            <span class="billing-detail">${daysRemaining} days remaining</span>
                        </div>
                        
                        <div class="billing-detail-card">
                            <span class="billing-label">Status</span>
                            <span class="billing-value" style="font-size: 1.25rem; text-transform: capitalize;">
                                ${subscriptionStatus === 'trialing' ? '60 Days Included' : subscriptionStatus}
                            </span>
                            <span class="billing-detail">${isInTrial ? 'Activation fee paid' : 'Active subscription'}</span>
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
                ` : ''}
                
                ${tier !== 'enterprise' ? `
                    <div class="upgrade-section" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.2);">
                        <h3 style="color: ${colors.text};">${tier === 'free' ? 'Upgrade Your Business' : 'Need More Features?'}</h3>
                        <button class="btn-upgrade" style="background: rgba(255,255,255,0.95); color: ${colors.bg}; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;" 
                                onclick="window.subscriptionManager.showUpgradeModal('settings', '${tier === 'free' ? 'basic' : tier === 'basic' ? 'premium' : 'enterprise'}')">
                            ${tier === 'free' ? 'View Plans' : 'Upgrade Plan'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async openBillingPortal() {
        try {
            const response = await fetch('/api/create-billing-portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: this.restaurant.stripe_customer_id,
                    returnUrl: window.location.href
                })
            });

            if (response.ok) {
                const { url } = await response.json();
                window.location.href = url;
            } else {
                alert('Unable to open billing portal. Please try again.');
            }
        } catch (error) {
            console.error('Error opening billing portal:', error);
            alert('Error opening billing portal');
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
            alert('Please enter a valid email address');
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
                alert('This email is already authorized');
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
            
            alert(`${email} is now authorized to validate stamps.`);
            
        } catch (error) {
            console.error('Error adding authorized email:', error);
            alert('Error authorizing email');
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
            alert('Error removing authorization');
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
            
            alert('Restaurant information updated successfully');
            
        } catch (error) {
            console.error('Error updating restaurant:', error);
            alert('Error updating restaurant information');
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

// Add required styles
if (!document.getElementById('billing-styles')) {
    const styles = document.createElement('style');
    styles.id = 'billing-styles';
    styles.textContent = `
        .usage-overview-section {
            margin-bottom: 2rem;
        }
        
        .usage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .usage-card {
            background: #f9fafb;
            padding: 1.25rem;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .usage-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        
        .usage-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: #374151;
        }
        
        .usage-count {
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .usage-bar {
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 0.5rem;
        }
        
        .usage-progress {
            height: 100%;
            background: #7c5ce6;
            transition: width 0.3s ease;
        }
        
        .usage-limit {
            font-size: 0.75rem;
            color: #6b7280;
        }
        
        .billing-info-section {
            position: relative;
            overflow: hidden;
        }
        
        .billing-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2rem;
        }
        
        .billing-details-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin: 2rem 0;
        }
        
        .billing-detail-card {
            background: rgba(255,255,255,0.1);
            padding: 1.25rem;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .billing-label {
            display: block;
            font-size: 0.875rem;
            opacity: 0.9;
            margin-bottom: 0.5rem;
        }
        
        .billing-value {
            display: block;
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }
        
        .billing-detail {
            display: block;
            font-size: 0.813rem;
            opacity: 0.8;
        }
        
        .staff-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 0.75rem;
        }
        
        .staff-info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .staff-email {
            font-weight: 500;
            color: #111827;
        }
        
        .staff-badge {
            background: #dbeafe;
            color: #1e40af;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .remove-staff {
            background: #fee2e2;
            border: 1px solid #fca5a5;
            color: #ef4444;
            padding: 0.5rem;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .remove-staff:hover {
            background: #ef4444;
            color: white;
        }
        
        .btn-manage-billing:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        @media (max-width: 768px) {
            .usage-grid {
                grid-template-columns: 1fr;
            }
            
            .billing-details-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(styles);
}
