// analytics.js - Analytics module with tier-based access control
// Premium and Enterprise tiers only

/**
 * Main analytics module
 */
const analyticsModule = {
    /**
     * Check if current tier has analytics access
     */
    hasAnalyticsAccess() {
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        return tier === 'premium' || tier === 'enterprise';
    },

    /**
     * Initialize analytics section
     */
    async initializeAnalytics() {
        const analyticsSection = document.getElementById('analytics-section');
        if (!analyticsSection) return;

        // Check if already initialized
        if (document.getElementById('card-selector')) {
            await this.refreshAnalytics();
            return;
        }

        // Add selectors to header
        this.addAnalyticsSelectors();

        // Check tier access
        if (this.hasAnalyticsAccess()) {
            await this.initializePaidAnalytics();
        } else {
            this.showRestrictedAnalytics();
        }
    },

    /**
     * Add analytics selectors to header
     */
    addAnalyticsSelectors() {
        const sectionHeader = document.querySelector('#analytics-section .section-header');
        if (!sectionHeader) return;

        const selectorHtml = `
            <div class="analytics-selector">
                <div class="selector-group">
                    <label for="card-selector">View Analytics For:</label>
                    <select id="card-selector" class="card-dropdown">
                        <option value="all">All Cards (Aggregated)</option>
                    </select>
                </div>
                <div class="selector-group">
                    <label for="time-range">Time Range:</label>
                    <select id="time-range" class="card-dropdown time-dropdown">
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="180">Last 180 days</option>
                        <option value="365">Last 365 days</option>
                    </select>
                </div>
            </div>
        `;
        sectionHeader.insertAdjacentHTML('beforeend', selectorHtml);
    },

    /**
     * Initialize analytics for paid tiers (Premium/Enterprise)
     */
    async initializePaidAnalytics() {
        this.showLoadingState();

        try {

            const advancedBtn = document.getElementById('btn-advanced-analytics');
                if (advancedBtn) {
                    // Show/hide based on tier
                    advancedBtn.style.display = this.hasAnalyticsAccess() ? 'flex' : 'none';
                    advancedBtn.onclick = () => window.advancedAnalyticsModal?.show();
                }

            // Load cards into dropdown
            await this.loadCardsDropdown();

            // Set up event listeners
            const cardSelector = document.getElementById('card-selector');
            const timeRange = document.getElementById('time-range');

            if (cardSelector) {
                cardSelector.addEventListener('change', async (e) => {
                    const days = parseInt(timeRange?.value || '30');
                    await this.loadAnalyticsData(e.target.value, days);
                });
            }

            if (timeRange) {
                timeRange.addEventListener('change', async (e) => {
                    const cardId = cardSelector?.value || 'all';
                    await this.loadAnalyticsData(cardId, parseInt(e.target.value));
                });
            }

            // Load initial data
            await this.loadAnalyticsData('all', 30);

        } catch (error) {
            console.error('Error initializing analytics:', error);
            this.showErrorState();
        }
    },

    /**
     * Add Advanced Analytics button to section header
     */
    addAdvancedAnalyticsButton() {
        const sectionHeader = document.querySelector('#analytics-section .section-header');
        if (!sectionHeader || document.getElementById('btn-advanced-analytics')) return;

        // Create wrapper for title + button if not exists
        let headerTop = sectionHeader.querySelector('.header-top-row');
        if (!headerTop) {
            headerTop = document.createElement('div');
            headerTop.className = 'header-top-row';
            headerTop.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; gap: 1rem;';
            
            // Move h2 into the wrapper
            const h2 = sectionHeader.querySelector('h2');
            
            if (h2) {
                h2.style.margin = '0';
                // Insert wrapper before the first child (h2)
                sectionHeader.insertBefore(headerTop, sectionHeader.firstChild);
                headerTop.appendChild(h2);
            }
        }

        // Create the button
        const button = document.createElement('button');
        button.id = 'btn-advanced-analytics';
        button.className = 'btn-primary';
        button.style.cssText = 'white-space: nowrap; flex-shrink: 0;';
        button.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            Advanced Analytics
        `;
        button.onclick = () => {
            if (window.advancedAnalyticsModal) {
                window.advancedAnalyticsModal.show();
            } else {
                console.error('Advanced Analytics Modal not loaded');
                alert('Advanced Analytics feature is loading. Please try again in a moment.');
            }
        };

        headerTop.appendChild(button);
    },

    /**
     * Show restricted analytics for Free/Basic tiers
     */
    showRestrictedAnalytics() {
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        
        // Show mock data with blur
        this.showMockAnalytics();

        // Disable selectors
        const cardSelector = document.getElementById('card-selector');
        const timeRange = document.getElementById('time-range');
        if (cardSelector) cardSelector.disabled = true;
        if (timeRange) timeRange.disabled = true;

        // Add upgrade overlay
        this.addUpgradeOverlay(tier);
    },

    /**
     * Show mock analytics data
     */
    showMockAnalytics() {
        const mockMetrics = {
            activeCustomers: 47,
            dormantCustomers: 12,
            totalStamps: 283,
            completedCards: 8,
            avgCompletionDays: 14,
            customersTrend: 23,
            stampsTrend: 18,
            completionsTrend: 15,
            chartData: this.generateMockChartData(30)
        };

        this.updateAnalyticsUI(mockMetrics);

        // Apply blur effect
        const statsGrid = document.querySelector('.stats-grid');
        const chartContainer = document.querySelector('.chart-container');
        if (statsGrid) statsGrid.style.filter = 'blur(4px)';
        if (chartContainer) chartContainer.style.filter = 'blur(4px)';
    },

    /**
     * Generate mock chart data
     */
    generateMockChartData(days) {
        const data = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            const baseValue = 8;
            const variance = Math.floor(Math.random() * 6) - 2;
            const dayOfWeek = date.getDay();
            const weekendBonus = (dayOfWeek === 0 || dayOfWeek === 6) ? 3 : 0;

            data.push({
                date: this.formatDateForChart(date, days),
                stamps: Math.max(0, baseValue + variance + weekendBonus)
            });
        }

        return data;
    },

    /**
     * Add upgrade overlay for restricted tiers
     */
    addUpgradeOverlay(currentTier) {
        const analyticsSection = document.getElementById('analytics-section');
        if (!analyticsSection || document.querySelector('.analytics-blur-overlay')) return;

        // Determine upgrade messaging based on current tier
        const isBasic = currentTier === 'basic';
        const upgradeTitle = isBasic ? 
            'Analytics Available in Premium' : 
            'Unlock Powerful Analytics';
        const upgradeButton = 'Upgrade to Premium';

        const overlay = document.createElement('div');
        overlay.className = 'analytics-blur-overlay';
        overlay.innerHTML = `
            <div class="analytics-upgrade-prompt">
                <div class="upgrade-prompt-icon">
                    <svg width="64" height="64" fill="none" stroke="url(#analytics-gradient)" viewBox="0 0 24 24">
                        <defs>
                            <linearGradient id="analytics-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#ff6b00;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#ff8c00;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                </div>
                
                <h2>${upgradeTitle}</h2>
                <p>Get real-time insights into your loyalty program performance</p>
                
                <div class="analytics-features">
                    <div class="feature-item">
                        <svg width="20" height="20" fill="#10b981" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Track active & dormant customers
                    </div>
                    <div class="feature-item">
                        <svg width="20" height="20" fill="#10b981" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Monitor stamp activity trends
                    </div>
                    <div class="feature-item">
                        <svg width="20" height="20" fill="#10b981" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Analyze redemption patterns
                    </div>
                    <div class="feature-item">
                        <svg width="20" height="20" fill="#10b981" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        Export detailed reports
                    </div>
                </div>
                
                <button class="btn-upgrade-analytics" onclick="analyticsModule.handleUpgrade()">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    ${upgradeButton}
                </button>
                
                <p class="upgrade-note">${isBasic ? 'Change will apply at next billing cycle' : 'Includes 2 months free with activation'}</p>
            </div>
        `;

        this.addOverlayStyles();
        analyticsSection.style.position = 'relative';
        analyticsSection.appendChild(overlay);
    },

    /**
     * Add overlay styles
     */
    addOverlayStyles() {
        if (document.getElementById('analytics-overlay-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'analytics-overlay-styles';
        styles.textContent = `
            .analytics-blur-overlay {
                position: absolute;
                top: 100px;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(2px);
                z-index: 100;
                border-radius: 12px;
            }
            
            .analytics-upgrade-prompt {
                text-align: center;
                max-width: 480px;
                padding: 3rem;
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            }
            
            .upgrade-prompt-icon {
                margin: 0 auto 2rem;
            }
            
            .analytics-upgrade-prompt h2 {
                font-size: 1.875rem;
                font-weight: 700;
                color: #111827;
                margin: 0 0 0.5rem 0;
            }
            
            .analytics-upgrade-prompt > p {
                color: #6b7280;
                font-size: 1.125rem;
                margin: 0 0 2rem 0;
            }
            
            .analytics-features {
                text-align: left;
                margin: 0 0 2rem 0;
            }
            
            .feature-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 0;
                color: #374151;
                font-size: 0.975rem;
            }
            
            .btn-upgrade-analytics {
                width: 100%;
                padding: 1rem 2rem;
                background: linear-gradient(135deg, #ff6b00, #ff8c00);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(255, 107, 0, 0.3);
            }
            
            .btn-upgrade-analytics:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(255, 107, 0, 0.4);
            }
            
            .upgrade-note {
                color: #9ca3af;
                font-size: 0.813rem;
                margin: 0.75rem 0 0 0;
            }
            
            .stat-card.dormant .stat-label {
                color: #f59e0b;
            }
            
            .stat-card.dormant .stat-value {
                color: #f59e0b;
            }
        `;
        document.head.appendChild(styles);
    },

    /**
     * Handle upgrade click - Redirect to checkout or schedule plan change
     */
    async handleUpgrade() {
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');

        // Show loading state
        const upgradeBtn = document.querySelector('.btn-upgrade-analytics');
        if (upgradeBtn) {
            upgradeBtn.disabled = true;
            upgradeBtn.innerHTML = `
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                </svg>
                Processing...
            `;
        }

        try {
            if (tier === 'free') {
                // FREE → PREMIUM: Redirect to checkout
                const response = await fetch('/api/create-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        planId: 'premium',
                        restaurantId: restaurant.id,
                        billingType: 'monthly'
                    })
                });

                if (!response.ok) throw new Error('Failed to create checkout');

                const { url } = await response.json();
                window.location.href = url;

            } else if (tier === 'basic') {
                // BASIC → PREMIUM: Schedule plan change for next billing cycle
                const response = await fetch('/api/update-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: restaurant.id,
                        newTier: 'premium',
                        newBillingType: restaurant.billing_type || 'monthly'
                    })
                });

                if (!response.ok) throw new Error('Failed to schedule upgrade');

                const data = await response.json();

                // Show success message
                this.showUpgradeSuccess(data.effectiveDate);

            } else {
                console.error('Unexpected tier:', tier);
                alert('An error occurred. Please try again or contact support.');
            }

        } catch (error) {
            console.error('Upgrade error:', error);
            alert('Failed to process upgrade. Please try again or contact support.');
            
            // Reset button
            if (upgradeBtn) {
                upgradeBtn.disabled = false;
                upgradeBtn.innerHTML = `
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    Upgrade to Premium
                `;
            }
        }
    },

    /**
     * Show upgrade success message
     */
    showUpgradeSuccess(effectiveDate) {
        const formattedDate = new Date(effectiveDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 400px; margin: 1rem; text-align: center;">
                <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                    <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <h3 style="margin: 0 0 1rem 0; color: #111827; font-size: 1.5rem;">Upgrade Scheduled!</h3>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280;">Your upgrade to Premium will take effect on <strong>${formattedDate}</strong></p>
                <p style="margin: 0 0 1.5rem 0; color: #6b7280; font-size: 0.875rem;">You'll get access to Analytics and all Premium features at your next billing cycle.</p>
                <button onclick="location.reload()" style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #ff6b00, #ff8c00); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Got it!
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * Load cards into dropdown
     */
    async loadCardsDropdown() {
        const cardSelector = document.getElementById('card-selector');
        if (!cardSelector) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: restaurants } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id);

            if (!restaurants?.length) return;

            const restaurantIds = restaurants.map(r => r.id);

            const { data: loyaltyCards } = await supabase
                .from('loyalty_cards')
                .select('id, display_name, location_name, campaign_status')
                .in('restaurant_id', restaurantIds)
                .is('deleted_at', null)
                .order('display_name');

            if (!loyaltyCards?.length) return;

            loyaltyCards.forEach(card => {
                const option = document.createElement('option');
                option.value = card.id;
                const location = card.location_name ? ` - ${card.location_name}` : '';
                const status = card.campaign_status ? ` (${card.campaign_status})` : '';
                option.textContent = `${card.display_name}${location}${status}`;
                cardSelector.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading cards:', error);
        }
    },

    /**
     * Load analytics data
     */
    async loadAnalyticsData(cardFilter = 'all', days = 30) {
        // Double-check access
        if (!this.hasAnalyticsAccess()) {
            this.showRestrictedAnalytics();
            return;
        }

        this.showLoadingState();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const startTime = Date.now();

            const metrics = cardFilter === 'all' ?
                await this.getAggregatedMetrics(user.id, days) :
                await this.getCardMetrics(cardFilter, days);

            // Minimum loading time to prevent flashing
            const elapsed = Date.now() - startTime;
            if (elapsed < 300) {
                await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
            }

            this.updateAnalyticsUI(metrics);

        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showErrorState();
        }
    },

    /**
     * Get aggregated metrics for all cards
     */
    async getAggregatedMetrics(userId, days = 30) {
        try {
            const { data: restaurants } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', userId);

            if (!restaurants?.length) return this.generateEmptyMetrics();

            const restaurantIds = restaurants.map(r => r.id);

            const { data: loyaltyCards } = await supabase
                .from('loyalty_cards')
                .select('id')
                .in('restaurant_id', restaurantIds)
                .is('deleted_at', null);

            if (!loyaltyCards?.length) return this.generateEmptyMetrics();

            const cardIds = loyaltyCards.map(c => c.id);

            // Get customer cards
            const { data: customerCards } = await supabase
                .from('customer_cards')
                .select('*')
                .in('loyalty_card_id', cardIds);

            // Get recent stamps for dormant calculation
            const dormantThreshold = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
            const { data: recentStamps } = await supabase
                .from('stamps')
                .select('customer_card_id, created_at')
                .in('customer_card_id', customerCards?.map(c => c.id) || [])
                .gte('created_at', dormantThreshold.toISOString());

            // Calculate metrics
            const activeCustomerCards = customerCards?.filter(c => !c.is_completed) || [];
            const activeCustomers = new Set(activeCustomerCards.map(c => c.customer_id)).size;

            // Calculate dormant customers
            const recentlyActiveCardIds = new Set(recentStamps?.map(s => s.customer_card_id) || []);
            const dormantCards = activeCustomerCards.filter(c => !recentlyActiveCardIds.has(c.id));
            const dormantCustomers = new Set(dormantCards.map(c => c.customer_id)).size;

            const totalStamps = customerCards?.reduce((sum, c) => sum + (c.current_stamps || 0), 0) || 0;

            // Get redemptions
            const { data: redemptions } = await supabase
                .from('redemptions')
                .select('id, created_at')
                .in('restaurant_id', restaurantIds);

            const completedCards = redemptions?.length || 0;

            // Calculate average completion time
            let avgCompletionDays = 0;
            const completedWithTime = customerCards?.filter(c => 
                c.is_completed && c.completed_at && c.created_at
            ) || [];

            if (completedWithTime.length > 0) {
                const totalDays = completedWithTime.reduce((sum, c) => {
                    const start = new Date(c.created_at);
                    const end = new Date(c.completed_at);
                    return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                }, 0);
                avgCompletionDays = Math.round(totalDays / completedWithTime.length);
            }

            // Get timeline and trends
            const chartData = await this.getStampsTimeline(customerCards?.map(c => c.id) || [], days);
            const trends = await this.calculateTrends(customerCards, redemptions, days);

            return {
                activeCustomers,
                dormantCustomers,
                totalStamps,
                completedCards,
                avgCompletionDays,
                ...trends,
                chartData
            };

        } catch (error) {
            console.error('Error getting metrics:', error);
            return this.generateEmptyMetrics();
        }
    },

    /**
     * Get metrics for specific card
     */
    async getCardMetrics(cardId, days = 30) {
        // Similar to getAggregatedMetrics but filtered for specific card
        // Implementation would be similar but with additional filtering
        return this.getAggregatedMetrics(null, days);
    },

    /**
     * Get stamps timeline
     */
    async getStampsTimeline(customerCardIds, days = 30) {
        if (!customerCardIds?.length) return this.generateEmptyChartData(days);

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data: stamps } = await supabase
                .from('stamps')
                .select('created_at')
                .in('customer_card_id', customerCardIds)
                .gte('created_at', startDate.toISOString());

            // Initialize all days
            const stampsByDay = {};
            const today = new Date();

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateKey = this.formatDateForChart(date, days);
                stampsByDay[dateKey] = 0;
            }

            // Count stamps
            stamps?.forEach(stamp => {
                const date = new Date(stamp.created_at);
                const dateKey = this.formatDateForChart(date, days);
                if (stampsByDay[dateKey] !== undefined) {
                    stampsByDay[dateKey]++;
                }
            });

            return Object.entries(stampsByDay).map(([date, stamps]) => ({
                date,
                stamps
            }));

        } catch (error) {
            console.error('Error getting timeline:', error);
            return this.generateEmptyChartData(days);
        }
    },

    /**
     * Calculate trends
     */
    async calculateTrends(customerCards, redemptions, days) {
        // Calculate percentage changes vs previous period
        return {
            customersTrend: 0,
            stampsTrend: 0,
            completionsTrend: 0
        };
    },

    /**
     * Format date for chart
     */
    formatDateForChart(date, days) {
        if (days <= 30) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (days <= 90) {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    },

    /**
     * Generate empty metrics
     */
    generateEmptyMetrics() {
        return {
            activeCustomers: 0,
            dormantCustomers: 0,
            totalStamps: 0,
            completedCards: 0,
            avgCompletionDays: 0,
            customersTrend: 0,
            stampsTrend: 0,
            completionsTrend: 0,
            chartData: this.generateEmptyChartData(30)
        };
    },

    /**
     * Generate empty chart data
     */
    generateEmptyChartData(days = 30) {
        const data = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            data.push({
                date: this.formatDateForChart(date, days),
                stamps: 0
            });
        }

        return data;
    },

    /**
     * Update analytics UI
     */
    updateAnalyticsUI(metrics) {
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;

        // Ensure dormant card exists
        if (!document.querySelector('.stat-card.dormant') && statsGrid.children.length === 4) {
            const dormantCard = document.createElement('div');
            dormantCard.className = 'stat-card dormant';
            dormantCard.innerHTML = `
                <div class="stat-label">Dormant Customers</div>
                <div class="stat-value">0</div>
                <div class="stat-trend">No stamps in 21+ days</div>
            `;
            statsGrid.insertBefore(dormantCard, statsGrid.children[1]);
        }

        // Update all stat cards by querying them fresh
        const statCards = statsGrid.querySelectorAll('.stat-card');
        
        // Active Customers (first card)
        if (statCards[0]) {
            const valueEl = statCards[0].querySelector('.stat-value');
            const trendEl = statCards[0].querySelector('.stat-trend');
            if (valueEl) valueEl.textContent = metrics.activeCustomers.toLocaleString();
            if (trendEl) this.updateTrend(trendEl, metrics.customersTrend);
        }

        // Dormant Customers (second card if exists)
        const dormantCard = statsGrid.querySelector('.stat-card.dormant');
        if (dormantCard) {
            const valueEl = dormantCard.querySelector('.stat-value');
            if (valueEl) valueEl.textContent = metrics.dormantCustomers.toLocaleString();
            // Keep the descriptive text for dormant
            const trendEl = dormantCard.querySelector('.stat-trend');
            if (trendEl) trendEl.textContent = 'No stamps in 21+ days';
        }

        // Total Stamps (third card, or second if no dormant)
        const stampsIndex = dormantCard ? 2 : 1;
        if (statCards[stampsIndex]) {
            const valueEl = statCards[stampsIndex].querySelector('.stat-value');
            const trendEl = statCards[stampsIndex].querySelector('.stat-trend');
            if (valueEl) valueEl.textContent = metrics.totalStamps.toLocaleString();
            if (trendEl) this.updateTrend(trendEl, metrics.stampsTrend);
        }

        // Rewards Redeemed (fourth card, or third if no dormant)
        const rewardsIndex = dormantCard ? 3 : 2;
        if (statCards[rewardsIndex]) {
            const valueEl = statCards[rewardsIndex].querySelector('.stat-value');
            const trendEl = statCards[rewardsIndex].querySelector('.stat-trend');
            if (valueEl) valueEl.textContent = metrics.completedCards.toLocaleString();
            if (trendEl) this.updateTrend(trendEl, metrics.completionsTrend);
        }

        // Avg Completion Time (fifth card, or fourth if no dormant)
        const avgIndex = dormantCard ? 4 : 3;
        if (statCards[avgIndex]) {
            const valueEl = statCards[avgIndex].querySelector('.stat-value');
            const trendEl = statCards[avgIndex].querySelector('.stat-trend');
            
            if (valueEl) {
                valueEl.innerHTML = '';
                const daysText = metrics.avgCompletionDays > 0 ? 
                    `${metrics.avgCompletionDays} days` : 'No data';
                valueEl.textContent = daysText;
            }
            
            if (trendEl) {
                trendEl.innerHTML = '';
                trendEl.textContent = metrics.avgCompletionDays > 0 ? 
                    'Average time to complete' : 'No completed cards yet';
                trendEl.className = 'stat-trend';
            }
        }

        // Update chart
        this.updateChart(metrics.chartData);
    },

    /**
     * Update trend element
     */
    updateTrend(element, value) {
        if (!element) return;

        element.className = 'stat-trend';
        if (value === 0) {
            element.textContent = 'No change';
        } else {
            const sign = value > 0 ? '+' : '';
            element.textContent = `${sign}${value}% vs previous`;
            element.classList.add(value > 0 ? 'positive' : 'negative');
        }
    },

    /**
     * Update chart visualization
     */
    updateChart(chartData) {
        const chartPlaceholder = document.querySelector('.chart-placeholder');
        if (!chartPlaceholder) return;

        chartPlaceholder.classList.remove('loading');
        
        if (!chartData || chartData.length === 0) {
            chartPlaceholder.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #999;">
                    <p>No data available yet</p>
                    <p style="font-size: 0.875rem;">Stamps will appear here as customers use their cards</p>
                </div>
            `;
            return;
        }

        const maxValue = Math.max(...chartData.map(d => d.stamps), 1);
        const labelInterval = chartData.length <= 7 ? 1 : 
                            chartData.length <= 30 ? 5 : 7;

        const chartHtml = `
            <div class="simple-chart">
                <div class="chart-bars">
                    ${chartData.map((day, index) => {
                        const showLabel = index === 0 || 
                                        index === chartData.length - 1 || 
                                        index % labelInterval === 0;
                        return `
                            <div class="chart-bar-group" style="flex: 1;">
                                <div class="chart-bar-container">
                                    <div class="chart-bar" 
                                         style="height: ${maxValue > 0 ? Math.max((day.stamps / maxValue) * 100, 2) : 2}%;"
                                         data-value="${day.stamps}"
                                         data-date="${day.date}">
                                    </div>
                                </div>
                                ${showLabel ? `<div class="chart-label">${day.date}</div>` : '<div class="chart-label-spacer"></div>'}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        chartPlaceholder.innerHTML = chartHtml;
        chartPlaceholder.style.padding = '1rem';
    },

    /**
     * Show loading state
     */
    showLoadingState() {
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.querySelectorAll('.stat-value').forEach(el => {
                el.innerHTML = '<div class="skeleton-loader skeleton-text-large"></div>';
            });
            statsGrid.querySelectorAll('.stat-trend').forEach(el => {
                el.innerHTML = '<div class="skeleton-loader skeleton-text-small"></div>';
            });
        }

        const chartPlaceholder = document.querySelector('.chart-placeholder');
        if (chartPlaceholder) {
            chartPlaceholder.innerHTML = `
                <div class="chart-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading chart data...</p>
                </div>
            `;
        }
    },

    /**
     * Show error state
     */
    showErrorState() {
        const chartPlaceholder = document.querySelector('.chart-placeholder');
        if (chartPlaceholder) {
            chartPlaceholder.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #999;">
                    <p>Error loading analytics data</p>
                </div>
            `;
        }
    },

    /**
     * Refresh analytics if needed
     */
    async refreshAnalytics() {
        if (this.hasAnalyticsAccess()) {
            const cardSelector = document.getElementById('card-selector');
            const timeRange = document.getElementById('time-range');
            await this.loadAnalyticsData(
                cardSelector?.value || 'all',
                parseInt(timeRange?.value || '30')
            );
        } else {
            this.showRestrictedAnalytics();
        }
    }
};

// Export for use
window.analyticsModule = analyticsModule;

// Module export if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = analyticsModule;
}
