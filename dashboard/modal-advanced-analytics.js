// modal-advanced-analytics.js - Advanced Analytics Modal
// Premium/Enterprise only - Lazy loads data on button click

const advancedAnalyticsModal = {
    isOpen: false,
    currentTab: 'demographics',
    data: null,

    /**
     * Initialize the modal
     */
    init() {
        this.createModalHTML();
        this.attachStyles();
    },

    /**
     * Check if user has access
     */
    hasAccess() {
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        return tier === 'premium' || tier === 'enterprise';
    },

    /**
     * Show modal - loads data on first open
     */
    async show() {
        if (!this.hasAccess()) {
            window.subscriptionManager?.showUpgradeModal('advanced-analytics', 'premium');
            return;
        }

        const modal = document.getElementById('advanced-analytics-modal');
        if (!modal) {
            this.init();
        }

        this.isOpen = true;
        const modalEl = document.getElementById('advanced-analytics-modal');
        modalEl.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Load data only now
        if (!this.data) {
            await this.loadAllData();
        } else {
            this.renderCurrentTab();
        }
    },

    /**
     * Hide modal
     */
    hide() {
        this.isOpen = false;
        const modal = document.getElementById('advanced-analytics-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    },

    /**
     * Create modal HTML structure
     */
    createModalHTML() {
        const modal = document.createElement('div');
        modal.id = 'advanced-analytics-modal';
        modal.className = 'analytics-modal';
        modal.innerHTML = `
            <div class="analytics-modal-overlay" onclick="advancedAnalyticsModal.hide()"></div>
            <div class="analytics-modal-container">
                <div class="analytics-modal-header">
                    <div>
                        <h2>Advanced Analytics</h2>
                        <p class="modal-subtitle">Deep insights into customer behavior and demographics</p>
                    </div>
                    <button class="modal-close" onclick="advancedAnalyticsModal.hide()">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div class="analytics-tabs">
                    <button class="tab-btn active" data-tab="demographics" onclick="advancedAnalyticsModal.switchTab('demographics')">
                        Demographics
                    </button>
                    <button class="tab-btn" data-tab="behavior" onclick="advancedAnalyticsModal.switchTab('behavior')">
                        Behavior
                    </button>
                    <button class="tab-btn" data-tab="segments" onclick="advancedAnalyticsModal.switchTab('segments')">
                        Segments
                    </button>
                </div>

                <div class="analytics-modal-content" id="analytics-tab-content">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading analytics data...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * Attach CSS styles
     */
    attachStyles() {
        if (document.getElementById('advanced-analytics-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'advanced-analytics-styles';
        styles.textContent = `
            .analytics-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 1rem;
            }

            .analytics-modal.active {
                display: flex;
            }

            .analytics-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
            }

            .analytics-modal-container {
                position: relative;
                background: white;
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                max-width: 1100px;
                width: 100%;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .analytics-modal-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding: 2rem;
                border-bottom: 1px solid #f0f0f0;
            }

            .analytics-modal-header h2 {
                margin: 0 0 0.25rem 0;
                font-size: 1.75rem;
                font-weight: 700;
                color: #1a1a1a;
            }

            .modal-subtitle {
                margin: 0;
                font-size: 0.875rem;
                color: #666;
            }

            .modal-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 8px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .modal-close:hover {
                background: #f5f5f7;
                color: #333;
            }

            .analytics-tabs {
                display: flex;
                gap: 0.5rem;
                padding: 0 2rem;
                border-bottom: 1px solid #f0f0f0;
                background: #fafafa;
            }

            .tab-btn {
                background: none;
                border: none;
                padding: 1rem 1.5rem;
                font-size: 0.875rem;
                font-weight: 500;
                color: #666;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                position: relative;
                top: 1px;
            }

            .tab-btn:hover {
                color: #7c5ce6;
            }

            .tab-btn.active {
                color: #7c5ce6;
                border-bottom-color: #7c5ce6;
                background: white;
            }

            .analytics-modal-content {
                flex: 1;
                overflow-y: auto;
                padding: 2rem;
            }

            .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem 2rem;
            }

            .loading-spinner {
                width: 48px;
                height: 48px;
                border: 4px solid #f0f0f0;
                border-top-color: #7c5ce6;
                border-radius: 50%;
                animation: spinner 0.8s linear infinite;
                margin-bottom: 1rem;
            }

            @keyframes spinner {
                to { transform: rotate(360deg); }
            }

            .loading-state p {
                color: #666;
                font-size: 0.875rem;
                margin: 0;
            }

            .analytics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .analytics-card {
                background: white;
                padding: 1.5rem;
                border-radius: 12px;
                border: 1px solid #f0f0f0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }

            .analytics-card h3 {
                font-size: 1rem;
                font-weight: 600;
                color: #1a1a1a;
                margin: 0 0 1.5rem 0;
            }

            .chart-simple {
                min-height: 250px;
            }

            .bar-chart {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .bar-item {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .bar-label {
                min-width: 100px;
                font-size: 0.875rem;
                color: #666;
                font-weight: 500;
            }

            .bar-track {
                flex: 1;
                height: 32px;
                background: #f5f5f7;
                border-radius: 6px;
                position: relative;
                overflow: hidden;
            }

            .bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #7c5ce6, #a78bfa);
                border-radius: 6px;
                transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: center;
                justify-content: flex-end;
                padding-right: 0.75rem;
            }

            .bar-value {
                font-size: 0.75rem;
                font-weight: 600;
                color: white;
                text-shadow: 0 1px 2px rgba(0,0,0,0.2);
            }

            .segments-list {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .segment-card {
                background: linear-gradient(135deg, #f5f5f7 0%, #fafafa 100%);
                padding: 1.5rem;
                border-radius: 12px;
                border: 1px solid #e5e5e7;
            }

            .segment-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1rem;
            }

            .segment-title {
                font-size: 1.125rem;
                font-weight: 600;
                color: #1a1a1a;
                margin: 0;
            }

            .segment-badge {
                background: #7c5ce6;
                color: white;
                padding: 0.375rem 0.875rem;
                border-radius: 20px;
                font-size: 0.875rem;
                font-weight: 600;
            }

            .segment-description {
                font-size: 0.875rem;
                color: #666;
                margin: 0 0 1rem 0;
            }

            .segment-stats {
                display: flex;
                gap: 2rem;
            }

            .segment-stat {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .segment-stat-label {
                font-size: 0.75rem;
                color: #999;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .segment-stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: #1a1a1a;
            }

            .metric-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem 0;
                border-bottom: 1px solid #f5f5f7;
            }

            .metric-row:last-child {
                border-bottom: none;
            }

            .metric-label {
                font-size: 0.875rem;
                color: #666;
            }

            .metric-value {
                font-size: 1rem;
                font-weight: 600;
                color: #1a1a1a;
            }

            .empty-state {
                text-align: center;
                padding: 3rem 1rem;
                color: #999;
            }

            .empty-state svg {
                margin: 0 auto 1rem;
                opacity: 0.3;
            }

            .empty-state h3 {
                font-size: 1.125rem;
                color: #666;
                margin: 0 0 0.5rem 0;
            }

            .empty-state p {
                font-size: 0.875rem;
                margin: 0;
            }

            @media (max-width: 768px) {
                .analytics-modal-container {
                    max-height: 95vh;
                }

                .analytics-modal-header {
                    padding: 1.5rem;
                }

                .analytics-modal-content {
                    padding: 1.5rem;
                }

                .analytics-grid {
                    grid-template-columns: 1fr;
                }

                .analytics-tabs {
                    padding: 0 1rem;
                    overflow-x: auto;
                }

                .tab-btn {
                    padding: 0.875rem 1rem;
                    white-space: nowrap;
                }
            }
        `;
        document.head.appendChild(styles);
    },

    /**
     * Switch tab
     */
    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        this.renderCurrentTab();
    },

    /**
     * Load all analytics data
     */
    async loadAllData() {
        const content = document.getElementById('analytics-tab-content');
        content.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading analytics data...</p>
            </div>
        `;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            const { data: restaurants } = await supabase
                .from('restaurants')
                .select('id')
                .eq('owner_id', user.id);

            if (!restaurants?.length) {
                this.data = this.getEmptyData();
                this.renderCurrentTab();
                return;
            }

            const restaurantIds = restaurants.map(r => r.id);

            const { data: loyaltyCards } = await supabase
                .from('loyalty_cards')
                .select('id')
                .in('restaurant_id', restaurantIds)
                .is('deleted_at', null);

            if (!loyaltyCards?.length) {
                this.data = this.getEmptyData();
                this.renderCurrentTab();
                return;
            }

            const cardIds = loyaltyCards.map(c => c.id);

            // Fetch customer cards first
            const { data: customerCards } = await supabase
                .from('customer_cards')
                .select('*')
                .in('loyalty_card_id', cardIds);

            const customerCardIds = customerCards?.map(c => c.id) || [];

            // Then fetch the rest in parallel
            const [
                { data: stamps },
                { data: redemptions },
                { data: userProfiles }
            ] = await Promise.all([
                supabase.from('stamps').select('*').in('customer_card_id', customerCardIds),
                supabase.from('redemptions').select('*').in('restaurant_id', restaurantIds),
                supabase.from('user_profiles').select('*')
            ]);

            // Create lookup map for user profiles
            const profileMap = {};
            userProfiles?.forEach(p => {
                profileMap[p.user_id] = p;
            });

            // Process data
            this.data = {
                demographics: this.processDemographics(customerCards, profileMap),
                behavior: this.processBehavior(customerCards, stamps, redemptions, profileMap),
                segments: this.processSegments(customerCards, stamps)
            };

            this.renderCurrentTab();

        } catch (error) {
            console.error('Error loading analytics:', error);
            content.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3>Error Loading Data</h3>
                    <p>Unable to load analytics. Please try again.</p>
                </div>
            `;
        }
    },

    /**
     * Process demographics data
     */
    processDemographics(customerCards, profileMap) {
        const customerIds = [...new Set(customerCards?.map(c => c.customer_id) || [])];
        
        const ageGroups = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 };
        const genderCounts = { male: 0, female: 0, other: 0, unknown: 0 };
        const districts = {};

        const currentYear = new Date().getFullYear();

        customerIds.forEach(customerId => {
            const profile = profileMap[customerId];
            if (!profile) {
                genderCounts.unknown++;
                return;
            }

            // Age group
            if (profile.birthday_year) {
                const age = currentYear - profile.birthday_year;
                if (age >= 18 && age <= 25) ageGroups['18-25']++;
                else if (age >= 26 && age <= 35) ageGroups['26-35']++;
                else if (age >= 36 && age <= 45) ageGroups['36-45']++;
                else if (age >= 46 && age <= 55) ageGroups['46-55']++;
                else if (age >= 56) ageGroups['56+']++;
            }

            // Gender
            const gender = profile.gender?.toLowerCase() || 'unknown';
            if (gender === 'male' || gender === 'female' || gender === 'other') {
                genderCounts[gender]++;
            } else {
                genderCounts.unknown++;
            }

            // Districts
            if (profile.district) {
                districts[profile.district] = (districts[profile.district] || 0) + 1;
            }
        });

        // Top 10 districts
        const topDistricts = Object.entries(districts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        return { ageGroups, genderCounts, topDistricts };
    },

    /**
     * Process behavior data
     */
    processBehavior(customerCards, stamps, redemptions, profileMap) {
        const completionByAge = { '18-25': { completed: 0, total: 0 }, '26-35': { completed: 0, total: 0 }, '36-45': { completed: 0, total: 0 }, '46-55': { completed: 0, total: 0 }, '56+': { completed: 0, total: 0 } };
        const stampsByGender = { male: { stamps: 0, visits: 0 }, female: { stamps: 0, visits: 0 }, other: { stamps: 0, visits: 0 } };
        
        const currentYear = new Date().getFullYear();

        customerCards?.forEach(card => {
            const profile = profileMap[card.customer_id];
            
            // Completion by age
            if (profile?.birthday_year) {
                const age = currentYear - profile.birthday_year;
                let ageGroup = '';
                if (age >= 18 && age <= 25) ageGroup = '18-25';
                else if (age >= 26 && age <= 35) ageGroup = '26-35';
                else if (age >= 36 && age <= 45) ageGroup = '36-45';
                else if (age >= 46 && age <= 55) ageGroup = '46-55';
                else if (age >= 56) ageGroup = '56+';

                if (ageGroup && completionByAge[ageGroup]) {
                    completionByAge[ageGroup].total++;
                    if (card.is_completed) {
                        completionByAge[ageGroup].completed++;
                    }
                }
            }

            // Stamps by gender
            if (profile?.gender) {
                const gender = profile.gender.toLowerCase();
                if (stampsByGender[gender]) {
                    stampsByGender[gender].stamps += card.current_stamps || 0;
                    stampsByGender[gender].visits++;
                }
            }
        });

        // Calculate completion rates
        const completionRates = Object.entries(completionByAge).map(([age, data]) => ({
            age,
            rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
        }));

        // Calculate avg stamps per visit
        const avgStampsPerVisit = Object.entries(stampsByGender).map(([gender, data]) => ({
            gender,
            avg: data.visits > 0 ? (data.stamps / data.visits).toFixed(1) : 0
        }));

        return { completionRates, avgStampsPerVisit };
    },

    /**
     * Process segments data
     */
    processSegments(customerCards, stamps) {
        const now = Date.now();
        const day14 = 14 * 24 * 60 * 60 * 1000;
        const day30 = 30 * 24 * 60 * 60 * 1000;

        const vipCustomers = new Set();
        const atRiskCustomers = new Set();
        const newCustomers = new Set();

        customerCards?.forEach(card => {
            const createdAt = new Date(card.created_at).getTime();
            const completedAt = card.completed_at ? new Date(card.completed_at).getTime() : null;

            // VIP: completed in < 14 days
            if (completedAt && (completedAt - createdAt) < day14) {
                vipCustomers.add(card.customer_id);
            }

            // New: created < 30 days ago
            if (now - createdAt < day30) {
                newCustomers.add(card.customer_id);
            }
        });

        // At Risk: no stamps in 30+ days
        const customerLastStamp = {};
        stamps?.forEach(stamp => {
            const card = customerCards?.find(c => c.id === stamp.customer_card_id);
            if (card) {
                const stampTime = new Date(stamp.created_at).getTime();
                if (!customerLastStamp[card.customer_id] || stampTime > customerLastStamp[card.customer_id]) {
                    customerLastStamp[card.customer_id] = stampTime;
                }
            }
        });

        Object.entries(customerLastStamp).forEach(([customerId, lastStamp]) => {
            if (now - lastStamp > day30) {
                atRiskCustomers.add(customerId);
            }
        });

        return {
            vip: vipCustomers.size,
            atRisk: atRiskCustomers.size,
            new: newCustomers.size
        };
    },

    /**
     * Get empty data structure
     */
    getEmptyData() {
        return {
            demographics: {
                ageGroups: { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 },
                genderCounts: { male: 0, female: 0, other: 0, unknown: 0 },
                topDistricts: []
            },
            behavior: {
                completionRates: [],
                avgStampsPerVisit: []
            },
            segments: {
                vip: 0,
                atRisk: 0,
                new: 0
            }
        };
    },

    /**
     * Render current tab
     */
    renderCurrentTab() {
        const content = document.getElementById('analytics-tab-content');
        if (!this.data) return;

        switch (this.currentTab) {
            case 'demographics':
                this.renderDemographics(content);
                break;
            case 'behavior':
                this.renderBehavior(content);
                break;
            case 'segments':
                this.renderSegments(content);
                break;
        }
    },

    /**
     * Render demographics tab
     */
    renderDemographics(content) {
        const { ageGroups, genderCounts, topDistricts } = this.data.demographics;

        const totalAge = Object.values(ageGroups).reduce((sum, val) => sum + val, 0);
        const totalGender = Object.values(genderCounts).reduce((sum, val) => sum + val, 0);

        content.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h3>Age Distribution</h3>
                    <div class="bar-chart">
                        ${Object.entries(ageGroups).map(([age, count]) => {
                            const percentage = totalAge > 0 ? (count / totalAge) * 100 : 0;
                            return `
                                <div class="bar-item">
                                    <div class="bar-label">${age} years</div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width: ${percentage}%">
                                            <span class="bar-value">${count}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="analytics-card">
                    <h3>Gender Breakdown</h3>
                    <div class="bar-chart">
                        ${Object.entries(genderCounts).filter(([key]) => key !== 'unknown').map(([gender, count]) => {
                            const percentage = totalGender > 0 ? (count / totalGender) * 100 : 0;
                            return `
                                <div class="bar-item">
                                    <div class="bar-label">${gender.charAt(0).toUpperCase() + gender.slice(1)}</div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width: ${percentage}%">
                                            <span class="bar-value">${count}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div class="analytics-card">
                <h3>Top 10 Districts</h3>
                ${topDistricts.length > 0 ? `
                    <div class="bar-chart">
                        ${topDistricts.map(district => {
                            const maxCount = Math.max(...topDistricts.map(d => d.count));
                            const percentage = (district.count / maxCount) * 100;
                            return `
                                <div class="bar-item">
                                    <div class="bar-label">${district.name}</div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width: ${percentage}%">
                                            <span class="bar-value">${district.count}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<p style="text-align: center; color: #999; padding: 2rem 0;">No district data available</p>'}
            </div>
        `;
    },

    /**
     * Render behavior tab
     */
    renderBehavior(content) {
        const { completionRates, avgStampsPerVisit } = this.data.behavior;

        content.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h3>Completion Rate by Age Group</h3>
                    <div class="bar-chart">
                        ${completionRates.map(item => `
                            <div class="bar-item">
                                <div class="bar-label">${item.age} years</div>
                                <div class="bar-track">
                                    <div class="bar-fill" style="width: ${item.rate}%">
                                        <span class="bar-value">${item.rate}%</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="analytics-card">
                    <h3>Avg Stamps per Visit (Gender)</h3>
                    <div class="bar-chart">
                        ${avgStampsPerVisit.map(item => {
                            const maxAvg = Math.max(...avgStampsPerVisit.map(i => parseFloat(i.avg)));
                            const percentage = maxAvg > 0 ? (parseFloat(item.avg) / maxAvg) * 100 : 0;
                            return `
                                <div class="bar-item">
                                    <div class="bar-label">${item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}</div>
                                    <div class="bar-track">
                                        <div class="bar-fill" style="width: ${percentage}%">
                                            <span class="bar-value">${item.avg}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render segments tab
     */
    renderSegments(content) {
        const { vip, atRisk, new: newCustomers } = this.data.segments;

        content.innerHTML = `
            <div class="segments-list">
                <div class="segment-card">
                    <div class="segment-header">
                        <h3 class="segment-title">VIP Customers</h3>
                        <span class="segment-badge">${vip}</span>
                    </div>
                    <p class="segment-description">
                        Customers who completed their loyalty card in less than 14 days
                    </p>
                    <div class="segment-stats">
                        <div class="segment-stat">
                            <span class="segment-stat-label">Count</span>
                            <span class="segment-stat-value">${vip}</span>
                        </div>
                        <div class="segment-stat">
                            <span class="segment-stat-label">Avg Days</span>
                            <span class="segment-stat-value">&lt;14</span>
                        </div>
                    </div>
                </div>

                <div class="segment-card">
                    <div class="segment-header">
                        <h3 class="segment-title">At Risk Customers</h3>
                        <span class="segment-badge" style="background: #f59e0b;">${atRisk}</span>
                    </div>
                    <p class="segment-description">
                        Customers who haven't received stamps in 30+ days
                    </p>
                    <div class="segment-stats">
                        <div class="segment-stat">
                            <span class="segment-stat-label">Count</span>
                            <span class="segment-stat-value">${atRisk}</span>
                        </div>
                        <div class="segment-stat">
                            <span class="segment-stat-label">Last Activity</span>
                            <span class="segment-stat-value">30+ days</span>
                        </div>
                    </div>
                </div>

                <div class="segment-card">
                    <div class="segment-header">
                        <h3 class="segment-title">New Customers</h3>
                        <span class="segment-badge" style="background: #10b981;">${newCustomers}</span>
                    </div>
                    <p class="segment-description">
                        Customers who joined in the last 30 days
                    </p>
                    <div class="segment-stats">
                        <div class="segment-stat">
                            <span class="segment-stat-label">Count</span>
                            <span class="segment-stat-value">${newCustomers}</span>
                        </div>
                        <div class="segment-stat">
                            <span class="segment-stat-label">Period</span>
                            <span class="segment-stat-value">&lt;30 days</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};

// Make globally available
window.advancedAnalyticsModal = advancedAnalyticsModal;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        advancedAnalyticsModal.init();
    });
} else {
    advancedAnalyticsModal.init();
}