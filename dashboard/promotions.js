// promotions.js - Matching Events Page Style Exactly

class PromotionsManager {
    constructor() {
        this.promotions = [];
        this.restaurant = null;
        this.currentFilter = 'active';
        this.init();
    }

    async init() {
        this.restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        this.setupEventListeners();
        await this.loadPromotions();
        this.displayUsageIndicator();
    }

    setupEventListeners() {
        const createBtn = document.getElementById('create-promotion-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.handleCreatePromotion());
        }

        document.querySelectorAll('.promotion-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    async loadPromotions() {
        try {
            const { data, error } = await supabase
                .from('promotions')
                .select('*')
                .eq('restaurant_id', this.restaurant.id)
                .order('start_date', { ascending: true });

            if (error) throw error;
            this.promotions = data || [];
            this.renderPromotions();
            
        } catch (error) {
            console.error('Error loading promotions:', error);
        }
    }

    displayUsageIndicator() {
        const container = document.querySelector('.promotions-usage-indicator');
        if (!container) return;
        
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        const tierConfig = window.subscriptionManager?.getTierConfig() || { maxLivePromotions: 1 };
        
        const activeCount = this.promotions.filter(p => p.status === 'active').length;
        const limit = tierConfig.maxLivePromotions;
        
        let html = '';
        
        if (tier === 'free') {
            html = `
                <div class="usage-banner ${activeCount >= limit ? 'at-limit' : ''}">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Free plan: ${activeCount} of ${limit} active promotion allowed</span>
                    ${activeCount >= limit ? `
                        <button class="btn-upgrade-inline" onclick="window.subscriptionManager.showUpgradeModal('promotions', 'basic')">
                            Upgrade for More
                        </button>
                    ` : ''}
                </div>
            `;
        } else {
            const percentage = (activeCount / limit) * 100;
            const isAtLimit = activeCount >= limit;
            
            html = `
                <div class="usage-banner ${isAtLimit ? 'at-limit' : ''}">
                    <div class="usage-text">
                        <span>Active Promotions: ${activeCount} of ${limit === 999 ? 'Unlimited' : limit}</span>
                    </div>
                    ${limit !== 999 ? `
                        <div class="usage-bar">
                            <div class="usage-progress" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    renderPromotions() {
        const now = new Date();
        const activePromotions = [];
        const pastPromotions = [];
        const draftPromotions = [];
        
        this.promotions.forEach(promotion => {
            if (promotion.status === 'draft' || promotion.status === 'paused') {
                draftPromotions.push(promotion);
            } else if (promotion.status === 'active') {
                // Check if promotion has ended
                let isPast = false;
                if (promotion.end_date) {
                    const endDate = new Date(promotion.end_date);
                    endDate.setHours(23, 59, 59, 999);
                    isPast = endDate < now;
                }
                
                if (isPast) {
                    pastPromotions.push(promotion);
                } else {
                    activePromotions.push(promotion);
                }
            }
        });
        
        this.updateTabCounts(activePromotions.length, pastPromotions.length, draftPromotions.length);
        
        let container;
        let promotionsToShow = [];
        
        switch(this.currentFilter) {
            case 'active':
                container = document.getElementById('active-promotions');
                promotionsToShow = activePromotions;
                break;
            case 'past':
                container = document.getElementById('past-promotions');
                promotionsToShow = pastPromotions;
                break;
            case 'draft':
                container = document.getElementById('draft-promotions');
                promotionsToShow = draftPromotions;
                break;
        }
        
        if (!container) return;
        
        if (promotionsToShow.length === 0) {
            container.innerHTML = this.getEmptyState();
        } else {
            container.innerHTML = `
                <div class="promotions-grid">
                    ${promotionsToShow.map(p => this.createCompactPromotionCard(p)).join('')}
                </div>
            `;
        }
        
        this.attachCardListeners();
    }

    createCompactPromotionCard(promotion) {
        const isActive = promotion.status === 'active';
        const isDraft = promotion.status === 'draft' || promotion.status === 'paused';
        const isPast = this.currentFilter === 'past';
        
        // Format dates
        const startDate = promotion.start_date ? new Date(promotion.start_date) : null;
        const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
        
        let dateStr = '';
        if (startDate) {
            dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (endDate) {
                dateStr += ` - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            }
        }
        
        // Format recurring days
        const daysMap = {
            'monday': 'Mon',
            'tuesday': 'Tue',
            'wednesday': 'Wed',
            'thursday': 'Thu',
            'friday': 'Fri',
            'saturday': 'Sat',
            'sunday': 'Sun'
        };
        
        let daysStr = '';
        if (promotion.recurring_days && promotion.recurring_days.length > 0) {
            daysStr = promotion.recurring_days.map(day => daysMap[day] || day).join(', ');
        }
        
        // Create promotion type badge content
        let badgeContent = '';
        if (promotion.discount_percentage) {
            badgeContent = `<div style="font-size: 14px; font-weight: 700;">${promotion.discount_percentage}%</div>`;
        } else if (promotion.discount_amount) {
            badgeContent = `<div style="font-size: 14px; font-weight: 700;">$${promotion.discount_amount}</div>`;
        } else {
            badgeContent = `
                <svg width="20" height="20" fill="currentColor" opacity="0.8" viewBox="0 0 24 24">
                    <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                </svg>
            `;
        }
        
        // Determine background style for badge
        let backgroundStyle = '';
        if (promotion.image_url) {
            backgroundStyle = `background-image: url('${promotion.image_url}'); background-size: cover; background-position: center;`;
        } else if (promotion.background_color) {
            backgroundStyle = `background: linear-gradient(135deg, ${promotion.background_color}, ${this.adjustColor(promotion.background_color, -20)});`;
        } else {
            backgroundStyle = 'background: linear-gradient(135deg, #667eea, #764ba2);';
        }
        
        // Build action buttons based on state
        let actionButtons = '';
        
        if (!isPast) {
            if (isDraft) {
                actionButtons = `
                    <button class="btn-action btn-edit" data-action="edit" data-id="${promotion.id}" data-tooltip="Edit">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    
                    <button class="btn-action btn-live" data-action="activate" data-id="${promotion.id}" data-tooltip="Go Live">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </button>
                `;
            } else {
                actionButtons = `
                    <button class="btn-action btn-pause" data-action="pause" data-id="${promotion.id}" data-tooltip="Pause">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </button>
                    
                    <button class="btn-action btn-edit" data-action="edit" data-id="${promotion.id}" data-tooltip="Edit">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                `;
            }
        }
        
        // Status dot
        let statusDot = '';
        if (isActive && !isPast) {
            statusDot = '<div class="promotion-status-dot active"></div>';
        } else if (isDraft) {
            statusDot = '<div class="promotion-status-dot draft"></div>';
        }
        
        return `
            <div class="promotion-card-compact ${isActive ? 'active' : ''} ${isDraft ? 'draft' : ''}" data-id="${promotion.id}">
                <div class="promotion-card-header">
                    <div class="promotion-visual-compact" style="${backgroundStyle}">
                        ${badgeContent}
                    </div>
                    
                    <div class="promotion-info-compact">
                        <h4>${promotion.title}</h4>
                        ${promotion.description ? `<p>${promotion.description.substring(0, 60)}${promotion.description.length > 60 ? '...' : ''}</p>` : ''}
                        <div class="promotion-meta-compact">
                            ${dateStr ? `
                                <span>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                    </svg>
                                    ${dateStr}
                                </span>
                            ` : ''}
                            ${daysStr ? `
                                <span>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    ${daysStr}
                                </span>
                            ` : ''}
                            ${promotion.time_restrictions ? `
                                <span>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    ${promotion.time_restrictions}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="promotion-actions-compact">
                        ${actionButtons}
                        
                        <button class="btn-action btn-delete" data-action="delete" data-id="${promotion.id}" data-tooltip="Delete">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                ${statusDot}
            </div>
        `;
    }

    updateTabCounts(activeCount, pastCount, draftCount) {
        const tabs = document.querySelectorAll('.promotion-tabs .tab-btn');
        tabs.forEach(tab => {
            const tabType = tab.dataset.tab;
            let count = 0;
            let label = '';
            
            switch(tabType) {
                case 'active':
                    count = activeCount;
                    label = 'Active';
                    break;
                case 'past':
                    count = pastCount;
                    label = 'Past';
                    break;
                case 'draft':
                    count = draftCount;
                    label = 'Drafts';
                    break;
            }
            
            tab.innerHTML = `${label} <span class="tab-count">(${count})</span>`;
        });
    }

    getEmptyState() {
        const messages = {
            'active': 'No active promotions',
            'past': 'No past promotions',
            'draft': 'No draft promotions'
        };
        
        const subtitles = {
            'active': 'Create a promotion to attract more customers',
            'past': '',
            'draft': ''
        };
        
        return `
            <div class="empty-state">
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                <h3>${messages[this.currentFilter]}</h3>
                ${subtitles[this.currentFilter] ? `<p>${subtitles[this.currentFilter]}</p>` : ''}
            </div>
        `;
    }

    attachCardListeners() {
        document.querySelectorAll('.promotion-card-compact .btn-action').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                switch(action) {
                    case 'activate':
                        await this.togglePromotionStatus(id, 'active');
                        break;
                    case 'pause':
                        await this.togglePromotionStatus(id, 'draft');
                        break;
                    case 'edit':
                        this.editPromotion(id);
                        break;
                    case 'delete':
                        if (confirm('Delete this promotion?')) {
                            await this.deletePromotion(id);
                        }
                        break;
                }
            });
        });
    }

    switchTab(tab) {
        document.querySelectorAll('.promotion-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Hide all tab contents
        document.querySelectorAll('#promotions-section .tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Show the selected tab content
        let tabContentIndex;
        switch(tab) {
            case 'active':
                tabContentIndex = 0;
                break;
            case 'past':
                tabContentIndex = 1;
                break;
            case 'draft':
                tabContentIndex = 2;
                break;
        }
        
        const tabContents = document.querySelectorAll('#promotions-section .tab-content');
        if (tabContents[tabContentIndex]) {
            tabContents[tabContentIndex].style.display = 'block';
        }
        
        this.currentFilter = tab;
        this.renderPromotions();
    }

    handleCreatePromotion() {
        if (window.openPromotionModal) {
            window.openPromotionModal();
        } else if (window.modalManager && window.modalManager.openPromotionModal) {
            window.modalManager.openPromotionModal();
        }
    }

async createPromotion(promotionData) {
    try {
        promotionData.restaurant_id = this.restaurant.id;
        
        // Fetch loyalty card location data BEFORE creating the promotion
        if (promotionData.loyalty_card_id) {
            const { data: loyaltyCard, error: cardError } = await supabase
                .from('loyalty_cards')
                .select('location_address, location_latitude, location_longitude, location_name, display_name')
                .eq('id', promotionData.loyalty_card_id)
                .single();
            
            if (!cardError && loyaltyCard) {
                promotionData.location_address = loyaltyCard.location_address;
                promotionData.location_latitude = loyaltyCard.location_latitude;
                promotionData.location_longitude = loyaltyCard.location_longitude;
                promotionData.location_name = loyaltyCard.location_name || loyaltyCard.display_name;
            }
        }
        
        // Check subscription limits
        if (promotionData.status === 'active' && window.subscriptionManager) {
            const canActivate = await window.subscriptionManager.canPerformAction('promotions', 'go_live');
            if (!canActivate.allowed) {
                promotionData.status = 'draft';
                alert('You\'ve reached your active promotion limit. The promotion will be saved as a draft.');
            }
        }

        // Now insert the promotion with location data already included
        const { data, error } = await supabase
            .from('promotions')
            .insert([{
                ...promotionData,
                created_at: new Date().toISOString(),
                view_count: 0,
                save_count: 0
            }])
            .select();

        if (error) throw error;

        await this.loadPromotions();
        return { success: true, data: data[0] };
        
    } catch (error) {
        console.error('Error creating promotion:', error);
        alert('Error creating promotion. Please try again.');
        return { success: false, error };
    }
}

    async togglePromotionStatus(id, newStatus) {
        try {
            if (newStatus === 'active' && window.subscriptionManager) {
                const canActivate = await window.subscriptionManager.canPerformAction('promotions', 'go_live');
                if (!canActivate.allowed) {
                    if (canActivate.requiresUpgrade) {
                        window.subscriptionManager.showUpgradeModal('promotions', canActivate.suggestedTier);
                    }
                    return;
                }
            }

            const { error } = await supabase
                .from('promotions')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            await this.loadPromotions();
            
        } catch (error) {
            console.error('Error toggling promotion status:', error);
        }
    }

    editPromotion(id) {
        const promotion = this.promotions.find(p => p.id === id);
        if (promotion) {
            if (window.openPromotionModal) {
                window.openPromotionModal(promotion);
            } else if (window.modalManager && window.modalManager.openPromotionModal) {
                window.modalManager.openPromotionModal(promotion);
            }
        }
    }

    async deletePromotion(id) {
        try {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await this.loadPromotions();
            
        } catch (error) {
            console.error('Error deleting promotion:', error);
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.promotionsManager = new PromotionsManager();
    });
} else {
    window.promotionsManager = new PromotionsManager();
}