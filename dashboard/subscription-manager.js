// subscription-manager.js - Enhanced subscription tier management system

class SubscriptionManager {
    constructor() {
        // Tier configuration - matches database subscription_tiers table
        this.tierConfig = {
            free: {
                maxLiveCards: 0,
                maxLivePromotions: 1,
                maxLiveEvents: 1,
                maxNotificationsPerMonth: 0,
                activationFee: 0,
                monthlyFee: 0,
                includedMonths: 0,
                displayName: 'Free',
                badgeColor: '#e5e7eb',
                textColor: '#4b5563'
            },
            basic: {
                maxLiveCards: 1,
                maxLivePromotions: 3,
                maxLiveEvents: 2,
                maxNotificationsPerMonth: 2,
                activationFee: 29.90,
                monthlyFee: 9.90,
                includedMonths: 2,
                displayName: 'Basic',
                badgeColor: '#dbeafe',
                textColor: '#1e40af'
            },
            premium: {
                maxLiveCards: 3,
                maxLivePromotions: 9,
                maxLiveEvents: 6,
                maxNotificationsPerMonth: 6,
                activationFee: 49.90,
                monthlyFee: 14.90,
                includedMonths: 2,
                displayName: 'Premium',
                badgeColor: '#d1fae5',
                textColor: '#059669'
            },
            enterprise: {
                maxLiveCards: 999,
                maxLivePromotions: 999,
                maxLiveEvents: 999,
                maxNotificationsPerMonth: 999,
                activationFee: null,
                monthlyFee: null,
                includedMonths: 0,
                displayName: 'Enterprise',
                badgeColor: '#fef3c7',
                textColor: '#92400e'
            }
        };
    }

    /**
     * Get current subscription tier
     * @returns {string} - 'free', 'basic', 'premium', or 'enterprise'
     */
    getCurrentTier() {
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        return restaurant.subscription_tier || 'free';
    }

    /**
     * Get tier configuration
     * @param {string} tier - Optional specific tier, defaults to current
     * @returns {object} - Tier configuration object
     */
    getTierConfig(tier = null) {
        const targetTier = tier || this.getCurrentTier();
        return this.tierConfig[targetTier] || this.tierConfig.free;
    }

    /**
     * Check if subscription is active (not expired)
     * @returns {Promise<boolean>}
     */
    async isSubscriptionActive() {
        try {
            const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
            const tier = restaurant.subscription_tier || 'free';
            
            // Free tier is always "active" but with limitations
            if (tier === 'free') return true;
            
            // Check if subscription is expired
            if (restaurant.subscription_ends_at) {
                const expiryDate = new Date(restaurant.subscription_ends_at);
                const now = new Date();
                return expiryDate > now;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking subscription status:', error);
            return false;
        }
    }

    /**
     * Check if user can perform a specific feature action
     * @param {string} feature - 'cards', 'promotions', 'events', 'notifications'
     * @param {string} action - 'create_draft', 'go_live'
     * @returns {Promise<object>} - {allowed, current, limit, message, requiresUpgrade, suggestedTier}
     */
    async canPerformAction(feature, action = 'go_live') {
        const tier = this.getCurrentTier();
        const config = this.getTierConfig();
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        
        // Draft creation is always allowed for all features
        if (action === 'create_draft') {
            return { 
                allowed: true, 
                message: 'Draft creation allowed for all tiers' 
            };
        }

        // Check limits for going live
        if (action === 'go_live') {
            let result = {
                allowed: false,
                current: 0,
                limit: 0,
                message: '',
                requiresUpgrade: false,
                suggestedTier: null
            };

            switch(feature) {
                case 'cards':
                    result = await this.checkCardLimit();
                    break;
                case 'promotions':
                    result = await this.checkPromotionLimit();
                    break;
                case 'events':
                    result = await this.checkEventLimit();
                    break;
                case 'notifications':
                    result = await this.checkNotificationLimit();
                    break;
            }

            return result;
        }

        return { 
            allowed: false, 
            message: 'Unknown action' 
        };
    }

    /**
     * Check loyalty card limits
     */
    async checkCardLimit() {
        const tier = this.getCurrentTier();
        const config = this.getTierConfig();
        
        try {
            // Get count of live cards
            const { data: liveCards, error } = await supabase
                .from('loyalty_cards')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', this.getRestaurantId())
                .eq('is_active', true)
                .is('deleted_at', null);
            
            const currentCount = liveCards?.length || 0;
            const limit = config.maxLiveCards;
            
            return {
                allowed: currentCount < limit,
                current: currentCount,
                limit: limit,
                message: limit === 0 ? 
                    'Free tier cannot make cards live. Upgrade to Basic to activate loyalty cards.' :
                    `You have ${currentCount} of ${limit} live cards`,
                requiresUpgrade: currentCount >= limit,
                suggestedTier: limit === 0 ? 'basic' : 
                               (tier === 'basic' ? 'premium' : 'enterprise')
            };
        } catch (error) {
            console.error('Error checking card limit:', error);
            return { allowed: false, message: 'Error checking limits' };
        }
    }

    /**
     * Check promotion limits
     */
    async checkPromotionLimit() {
        const tier = this.getCurrentTier();
        const config = this.getTierConfig();
        
        try {
            const { data: activePromos, error } = await supabase
                .from('promotions')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', this.getRestaurantId())
                .eq('status', 'active');
            
            const currentCount = activePromos?.length || 0;
            const limit = config.maxLivePromotions;
            
            return {
                allowed: currentCount < limit,
                current: currentCount,
                limit: limit,
                message: `You have ${currentCount} of ${limit} active promotions`,
                requiresUpgrade: currentCount >= limit,
                suggestedTier: this.getSuggestedTier(tier, 'promotions')
            };
        } catch (error) {
            console.error('Error checking promotion limit:', error);
            return { allowed: false, message: 'Error checking limits' };
        }
    }

    /**
     * Check event limits
     */
    async checkEventLimit() {
        const tier = this.getCurrentTier();
        const config = this.getTierConfig();
        
        try {
            const { data: activeEvents, error } = await supabase
                .from('events')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', this.getRestaurantId())
                .eq('status', 'active')
                .gte('event_date', new Date().toISOString().split('T')[0]);
            
            const currentCount = activeEvents?.length || 0;
            const limit = config.maxLiveEvents;
            
            return {
                allowed: currentCount < limit,
                current: currentCount,
                limit: limit,
                message: `You have ${currentCount} of ${limit} active events`,
                requiresUpgrade: currentCount >= limit,
                suggestedTier: this.getSuggestedTier(tier, 'events')
            };
        } catch (error) {
            console.error('Error checking event limit:', error);
            return { allowed: false, message: 'Error checking limits' };
        }
    }

    /**
     * Check notification limits (monthly)
     */
    async checkNotificationLimit() {
        const tier = this.getCurrentTier();
        const config = this.getTierConfig();
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        
        const currentCount = restaurant.notifications_sent_this_month || 0;
        const limit = config.maxNotificationsPerMonth;
        
        return {
            allowed: currentCount < limit,
            current: currentCount,
            limit: limit,
            message: limit === 0 ? 
                'Push notifications not available on Free tier' :
                `You've sent ${currentCount} of ${limit} notifications this month`,
            requiresUpgrade: currentCount >= limit,
            suggestedTier: limit === 0 ? 'basic' : this.getSuggestedTier(tier, 'notifications')
        };
    }

    /**
     * Get suggested upgrade tier based on current tier and feature
     */
    getSuggestedTier(currentTier, feature) {
        const tierOrder = ['free', 'basic', 'premium', 'enterprise'];
        const currentIndex = tierOrder.indexOf(currentTier);
        
        // If already on premium, suggest enterprise
        if (currentIndex >= 2) return 'enterprise';
        
        // Otherwise suggest next tier up
        return tierOrder[currentIndex + 1];
    }

    /**
     * Get restaurant ID from session
     */
    getRestaurantId() {
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        return restaurant.id;
    }

    /**
     * Refresh subscription status from database
     */
    async refreshSubscriptionStatus() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { data: restaurant, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('owner_id', user.id)
                .single();
            
            if (error || !restaurant) {
                console.error('Error fetching subscription status:', error);
                return;
            }
            
            // Update session storage
            sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
            
            // Update UI
            this.updateSubscriptionBadge();
            
            // Check if monthly reset is needed
            await this.checkMonthlyReset(restaurant);
            
        } catch (error) {
            console.error('Error refreshing subscription status:', error);
        }
    }

    /**
     * Check if monthly counters need reset
     */
    async checkMonthlyReset(restaurant) {
        if (!restaurant.subscription_started_at) return;
        
        const startDate = new Date(restaurant.subscription_started_at);
        const now = new Date();
        
        // Calculate months since subscription started
        const monthsSinceStart = (now.getFullYear() - startDate.getFullYear()) * 12 + 
                                (now.getMonth() - startDate.getMonth());
        
        // Reset on monthly billing date
        if (now.getDate() === startDate.getDate() || 
            (now.getDate() > 28 && startDate.getDate() > now.getDate())) {
            
            // Check if we need to reset (hasn't been reset this month)
            const lastReset = restaurant.last_notification_reset ? 
                new Date(restaurant.last_notification_reset) : startDate;
            
            if (lastReset.getMonth() !== now.getMonth() || 
                lastReset.getFullYear() !== now.getFullYear()) {
                
                // Reset monthly counters
                await supabase
                    .from('restaurants')
                    .update({
                        notifications_sent_this_month: 0,
                        last_notification_reset: now.toISOString()
                    })
                    .eq('id', restaurant.id);
                
                console.log('Monthly counters reset');
            }
        }
    }

    /**
     * Update subscription badge in sidebar
     */
    updateSubscriptionBadge() {
        const badge = document.querySelector('.subscription-badge');
        const badgeText = document.querySelector('.badge-text');
        
        if (!badge || !badgeText) return;
        
        const tier = this.getCurrentTier();
        const config = this.getTierConfig();
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        
        // Set badge style based on tier
        badge.style.background = config.badgeColor;
        badge.style.color = config.textColor;
        
        // Check if subscription is expired (for paid tiers)
        if (tier !== 'free' && restaurant.subscription_ends_at) {
            const expiryDate = new Date(restaurant.subscription_ends_at);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysRemaining <= 0) {
                badge.style.background = '#fee2e2';
                badge.style.color = '#dc2626';
                badgeText.textContent = 'Subscription Expired';
            } else if (daysRemaining <= 7) {
                badge.style.background = '#fef3c7';
                badge.style.color = '#d97706';
                badgeText.textContent = `${config.displayName} - ${daysRemaining} days left`;
            } else {
                badgeText.textContent = config.displayName;
            }
        } else {
            badgeText.textContent = config.displayName + (tier === 'free' ? ' Plan' : '');
        }
    }

    /**
     * Show upgrade modal with tier-specific messaging
     */
    showUpgradeModal(feature, requiredTier = 'basic') {
        const currentTier = this.getCurrentTier();
        const currentConfig = this.getTierConfig();
        const targetConfig = this.getTierConfig(requiredTier);
        
        // Remove any existing modal
        const existingModal = document.getElementById('upgrade-modal');
        if (existingModal) existingModal.remove();
        
        // Build feature-specific messaging
        let featureMessage = '';
        switch(feature) {
            case 'cards':
                featureMessage = `Make up to ${targetConfig.maxLiveCards} loyalty card${targetConfig.maxLiveCards > 1 ? 's' : ''} live`;
                break;
            case 'promotions':
                featureMessage = `Run up to ${targetConfig.maxLivePromotions} promotions simultaneously`;
                break;
            case 'events':
                featureMessage = `Host up to ${targetConfig.maxLiveEvents} events at once`;
                break;
            case 'notifications':
                featureMessage = `Send up to ${targetConfig.maxNotificationsPerMonth} push notifications per month`;
                break;
        }
        
        const modalHtml = `
            <div class="modal upgrade-modal" id="upgrade-modal">
                <div class="modal-backdrop" onclick="window.subscriptionManager.closeUpgradeModal()"></div>
                <div class="modal-content upgrade-modal-content">
                    <button class="modal-close" onclick="window.subscriptionManager.closeUpgradeModal()">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                    
                    <div class="upgrade-modal-header">
                        <h2>Upgrade to ${targetConfig.displayName}</h2>
                        <p class="upgrade-subtitle">${featureMessage}</p>
                    </div>
                    
                    <div class="upgrade-modal-body">
                        <div class="tier-comparison">
                            <div class="comparison-item current">
                                <h4>${currentConfig.displayName} (Current)</h4>
                                <ul>
                                    <li>Live Cards: ${currentConfig.maxLiveCards}</li>
                                    <li>Active Promotions: ${currentConfig.maxLivePromotions}</li>
                                    <li>Active Events: ${currentConfig.maxLiveEvents}</li>
                                    <li>Push Notifications: ${currentConfig.maxNotificationsPerMonth}/mo</li>
                                </ul>
                            </div>
                            <div class="comparison-item target">
                                <h4>${targetConfig.displayName}</h4>
                                <ul>
                                    <li>Live Cards: ${targetConfig.maxLiveCards}</li>
                                    <li>Active Promotions: ${targetConfig.maxLivePromotions}</li>
                                    <li>Active Events: ${targetConfig.maxLiveEvents}</li>
                                    <li>Push Notifications: ${targetConfig.maxNotificationsPerMonth}/mo</li>
                                </ul>
                                <div class="pricing-info">
                                    <p>€${targetConfig.activationFee} activation</p>
                                    <p>Then €${targetConfig.monthlyFee}/month after ${targetConfig.includedMonths} months</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="upgrade-modal-footer">
                        <button class="btn-primary" onclick="window.subscriptionManager.handleUpgrade('${requiredTier}')">
                            Upgrade to ${targetConfig.displayName}
                        </button>
                        <button class="btn-secondary" onclick="window.subscriptionManager.closeUpgradeModal()">
                            Not now
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Add animation
        setTimeout(() => {
            const modal = document.getElementById('upgrade-modal');
            if (modal) modal.classList.add('show');
        }, 10);
    }

    /**
     * Close upgrade modal
     */
    closeUpgradeModal() {
        const modal = document.getElementById('upgrade-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * Handle upgrade process
     */
    async handleUpgrade(targetTier) {
        this.closeUpgradeModal();
        
        // Navigate to billing section
        const settingsNav = document.querySelector('[data-section="settings"]');
        if (settingsNav) {
            settingsNav.click();
            
            // Store target tier for billing page
            sessionStorage.setItem('upgrade_target_tier', targetTier);
            
            setTimeout(() => {
                const billingSection = document.querySelector('.billing-overview');
                if (billingSection) {
                    billingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }

    /**
     * Log action to audit trail (for staff tracking)
     */
    async logAction(action, details) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const userRole = sessionStorage.getItem('userRole') || 'owner';
            
            await supabase
                .from('staff_audit_log')
                .insert({
                    restaurant_id: this.getRestaurantId(),
                    user_id: user.id,
                    user_email: user.email,
                    user_role: userRole,
                    action_type: action,
                    action_details: details
                });
        } catch (error) {
            console.error('Error logging action:', error);
        }
    }
}

// Initialize and export
const subscriptionManager = new SubscriptionManager();

// Make available globally
window.subscriptionManager = subscriptionManager;

// Also export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = subscriptionManager;
}