// cards-manager.js - Manages all loyalty cards with tier-based limits
// ENHANCED WITH NEW SUBSCRIPTION TIER SYSTEM AND PROMOTION RULES

/**
 * Initialize My Cards section
 */
function initializeMyCards() {
    // Display usage indicator
    displayCardUsageIndicator();
    
    // Search functionality
    const searchInput = document.getElementById('search-cards');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            filterCards(e.target.value);
        }, 300));
    }
    
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Apply filter
            const filter = btn.dataset.filter;
            filterCardsByStatus(filter);
        });
    });
}

/**
 * Display card usage indicator for tier limits
 */
async function displayCardUsageIndicator() {
    const usageContainer = document.querySelector('.cards-usage-indicator');
    if (!usageContainer) return;
    
    const tier = window.subscriptionManager.getCurrentTier();
    const tierConfig = window.subscriptionManager.getTierConfig();
    
    try {
        // Get live card count
        const { data: liveCards } = await supabase
            .from('loyalty_cards')
            .select('id', { count: 'exact' })
            .eq('restaurant_id', window.subscriptionManager.getRestaurantId())
            .eq('is_active', true)
            .is('deleted_at', null);
        
        const currentCount = liveCards?.length || 0;
        const limit = tierConfig.maxLiveCards;
        
        // Create usage indicator HTML
        let indicatorHtml = '';
        
        if (tier === 'free') {
            indicatorHtml = `
                <div class="usage-banner free-tier">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Free plan: Create unlimited drafts, upgrade to make cards live</span>
                    <button class="btn-upgrade-inline" onclick="window.subscriptionManager.showUpgradeModal('cards', 'basic')">
                        Upgrade Now
                    </button>
                </div>
            `;
        } else {
            const percentage = limit > 0 ? (currentCount / limit * 100) : 0;
            const isAtLimit = currentCount >= limit;
            
            indicatorHtml = `
                <div class="usage-banner ${isAtLimit ? 'at-limit' : ''}">
                    <div class="usage-text">
                        <span>Live Cards: ${currentCount} of ${limit === 999 ? 'Unlimited' : limit}</span>
                    </div>
                    ${limit !== 999 ? `
                        <div class="usage-bar">
                            <div class="usage-progress" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    ` : ''}
                    ${isAtLimit && tier !== 'enterprise' ? `
                        <button class="btn-upgrade-inline" onclick="window.subscriptionManager.showUpgradeModal('cards', '${tier === 'basic' ? 'premium' : 'enterprise'}')">
                            Need More?
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        usageContainer.innerHTML = indicatorHtml;
        
    } catch (error) {
        console.error('Error displaying usage indicator:', error);
    }
}

/**
 * Generate unique QR code for card
 */
function generateUniqueQRCode(restaurantSlug) {
    const randomString = Math.random().toString(36).substring(2, 7).toUpperCase();
    const prefix = restaurantSlug ? restaurantSlug.substring(0, 3).toUpperCase() : 'QR';
    return `${prefix}_${randomString}`;
}

/**
 * Load all loyalty cards with real-time stats from customer_cards
 */
async function loadMyCards() {
    const cardsGrid = document.getElementById('cards-grid');
    const noCardsState = document.getElementById('no-cards');
    
    if (!cardsGrid) return;
    
    // Show loading state
    cardsGrid.innerHTML = `
        <div class="loading-state">
            <svg class="animate-spin" width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                <path d="M4 12a8 8 0 018-8v8z" fill="currentColor"></path>
            </svg>
            <p>Loading cards...</p>
        </div>
    `;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');
        
        // Get all restaurants for this owner
        const { data: restaurants, error: restError } = await supabase
            .from('restaurants')
            .select('id, slug')
            .eq('owner_id', user.id);
        
        if (restError) throw restError;
        
        if (!restaurants || restaurants.length === 0) {
            cardsGrid.innerHTML = '';
            if (noCardsState) {
                noCardsState.style.display = 'flex';
            }
            return;
        }
        
        // Get all loyalty cards for these restaurants
        const restaurantIds = restaurants.map(r => r.id);
        const { data: loyaltyCards, error: cardsError } = await supabase
            .from('loyalty_cards')
            .select('*')
            .in('restaurant_id', restaurantIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        
        if (cardsError) throw cardsError;
        
        if (!loyaltyCards || loyaltyCards.length === 0) {
            cardsGrid.innerHTML = '';
            if (noCardsState) {
                noCardsState.style.display = 'flex';
            }
            return;
        }
        
        // Get stats for each loyalty card from customer_cards table
        for (let card of loyaltyCards) {
            // Get all customer cards for this loyalty program
            const { data: customerCards, error: customerCardsError } = await supabase
                .from('customer_cards')
                .select('customer_id, current_stamps, is_completed')
                .eq('loyalty_card_id', card.id);
            
            if (!customerCardsError && customerCards) {
                // Calculate active users (unique customers)
                const uniqueCustomers = new Set(customerCards.map(cc => cc.customer_id));
                card.active_users = uniqueCustomers.size;
                
                // Calculate rewards given (completed cards)
                card.rewards_given = customerCards.filter(cc => cc.is_completed === true).length;
                
                // Calculate total stamps given
                card.total_stamps = customerCards.reduce((sum, cc) => sum + (cc.current_stamps || 0), 0);
            } else {
                // Default values if query fails
                card.active_users = 0;
                card.rewards_given = 0;
                card.total_stamps = 0;
            }
        }
        
        // Add restaurant slug to cards for QR generation
        loyaltyCards.forEach(card => {
            const restaurant = restaurants.find(r => r.id === card.restaurant_id);
            card.restaurant_slug = restaurant?.slug || 'REST';
        });
        
        // Sort cards to put live ones first
        loyaltyCards.sort((a, b) => {
            const statusOrder = { 'live': 0, 'draft': 1 };
            const aStatus = a.campaign_status || (a.is_active ? 'live' : 'draft');
            const bStatus = b.campaign_status || (b.is_active ? 'live' : 'draft');
            
            const orderDiff = statusOrder[aStatus] - statusOrder[bStatus];
            if (orderDiff !== 0) return orderDiff;
            
            // If same status, sort by creation date (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // Hide no cards state
        if (noCardsState) {
            noCardsState.style.display = 'none';
        }
        
        // Render cards with updated stats
        cardsGrid.innerHTML = loyaltyCards.map(card => createCardElement(card)).join('');
        
        // Attach event listeners to card actions
        attachCardActionListeners();
        
        // Update usage indicator
        displayCardUsageIndicator();
        
    } catch (error) {
        console.error('Error loading cards:', error);
        cardsGrid.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 2rem; color: #999;">
                <p>Error loading cards. Please try again.</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Create card element HTML with tier-based controls and promotion rules
 */
function createCardElement(card) {
    const status = card.campaign_status || (card.is_active ? 'live' : 'draft');
    const hasQR = card.discovery_qr_code !== null;
    const tier = window.subscriptionManager.getCurrentTier();
    const tierConfig = window.subscriptionManager.getTierConfig();
    
    const statusColors = {
        draft: '#6b7280',
        live: '#10b981'
    };
    
    const statusColor = statusColors[status] || '#6b7280';
    const stampsCount = card.stamps_required || 10;
    const locationName = card.location_name || 'Main Location';
    
    // Generate stamps HTML
    let stampsHtml = '';
    for (let i = 0; i < stampsCount; i++) {
        stampsHtml += `<div class="stamp ${i < 3 ? 'filled' : ''}">${i < 3 ? '✓' : ''}</div>`;
    }
    
    // Add border class based on status
    const borderClass = status === 'live' ? 'card-item-live' : 'card-item-draft';
    
    // Determine the "Go Live" button based on tier
    let goLiveButton = '';
    if (status === 'draft') {
        if (tier === 'free') {
            // Free users see upgrade prompt
            goLiveButton = `
                <button class="btn-action btn-upgrade" 
                        onclick="window.subscriptionManager.showUpgradeModal('cards', 'basic')" 
                        data-tooltip="Upgrade to Basic to Go Live">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </button>
            `;
        } else {
            // Paid users can go live (within limits)
            goLiveButton = `
                <button class="btn-action btn-live" 
                        data-card-id="${card.id}" 
                        data-restaurant-slug="${card.restaurant_slug}" 
                        data-tooltip="Make Card Live">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </button>
            `;
        }
    }
    
    return `
        <div class="card-item ${borderClass}" data-card-id="${card.id}" data-status="${status}" data-name="${(card.display_name || '').toLowerCase()}">
            <!-- Status Badge on Top -->
            <div class="card-status-badge">
                <span class="status-dot"></span>
                ${status.toUpperCase()}
            </div>
            
            <div class="loyalty-card">
                <div class="card-background" id="card-bg-${card.id}" style="${!card.background_image_url && card.card_color ? `background: linear-gradient(135deg, ${card.card_color} 0%, ${adjustColor(card.card_color, -20)} 100%)` : ''}">
                    ${card.background_image_url 
                        ? `<img class="card-bg-image" src="${card.background_image_url}" style="display: block;">` 
                        : ''}
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <img class="card-logo" src="${card.logo_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z'/%3E%3C/svg%3E"}">
                        <div>
                            <div class="card-title">${card.display_name || 'Untitled Card'}</div>
                            ${card.show_location_on_card && card.location_name 
                                ? `<div class="card-location">${card.location_address}</div>` 
                                : ''}
                        </div>
                    </div>
                    
                    <div class="stamps-container">
                        <div class="stamps-grid" data-count="${stampsCount}">
                            ${stampsHtml}
                        </div>
                    </div>
                    
                    <div class="card-reward">
                        <span class="reward-label">Reward:</span>
                        <span class="reward-text">${card.reward_text || 'Free Item'}</span>
                    </div>
                    ${card.promotion_rules ? `
                        <div class="card-info-icon" title="${card.promotion_rules.replace(/"/g, '&quot;')}">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                            </svg>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-info ${status}">
                ${card.location_name ? `
                    <div class="card-location-info">
                        <svg width="14" height="14" fill="none" stroke="#666" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span>${locationName}</span>
                    </div>
                ` : ''}
                
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-label">Active Users:</span>
                        <span class="stat-value">${card.active_users || 0}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Rewards Given:</span>
                        <span class="stat-value">${card.rewards_given || 0}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Total Stamps:</span>
                        <span class="stat-value">${card.total_stamps || 0}</span>
                    </div>
                </div>
                
                <div class="card-actions">
                    ${status === 'draft' ? `
                        <button class="btn-action btn-edit" data-card-id="${card.id}" data-tooltip="Edit Card">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        
                        ${goLiveButton}
                        
                        <button class="btn-action btn-delete" data-card-id="${card.id}" data-tooltip="Delete Card">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    ` : ''}
                    
                    ${status === 'live' && hasQR ? `
                        <button class="btn-action btn-qr" data-card-id="${card.id}" data-qr-code="${card.discovery_qr_code}" data-card-name="${card.display_name}" data-tooltip="Download QR Code">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M4 12h.01M6 8h2m0 0V6a2 2 0 012-2h4a2 2 0 012 2v2m-6 0h4m-4 0a2 2 0 00-2 2v6a2 2 0 002 2h4a2 2 0 002-2v-6a2 2 0 00-2-2m-4 0h4"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners to card action buttons
 */
function attachCardActionListeners() {
    // Edit buttons (only for draft cards)
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editCard(btn.dataset.cardId));
    });
    
    // Go Live buttons (for paid users)
    document.querySelectorAll('.btn-live').forEach(btn => {
        btn.addEventListener('click', () => {
            const restaurantSlug = btn.dataset.restaurantSlug;
            showConfirmModal(
                'Go Live',
                'Putting the card live will generate the QR code for your restaurant. This action is irreversible - once live, the card cannot be edited or deleted.',
                'Go Live',
                () => makeCardLive(btn.dataset.cardId, restaurantSlug),
                'warning'
            );
        });
    });
    
    // Delete buttons (only for draft cards)
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => showConfirmModal(
            'Delete Card',
            'Are you sure you want to delete this loyalty card? This action cannot be undone.',
            'Delete',
            () => deleteCard(btn.dataset.cardId),
            'danger'
        ));
    });
    
    // QR Code buttons (only for live cards)
    document.querySelectorAll('.btn-qr').forEach(btn => {
        btn.addEventListener('click', () => {
            showQRCode(btn.dataset.cardId, btn.dataset.qrCode, btn.dataset.cardName);
        });
    });
}

/**
 * Make card live with tier limit checking
 */
async function makeCardLive(cardId, restaurantSlug) {
    try {
        // Check tier limits before making card live
        const canGoLive = await window.subscriptionManager.canPerformAction('cards', 'go_live');
        
        if (!canGoLive.allowed) {
            // Show upgrade modal if at limit
            if (canGoLive.requiresUpgrade) {
                window.subscriptionManager.showUpgradeModal('cards', canGoLive.suggestedTier);
                return;
            }
            
            // Show error message
            alert(canGoLive.message);
            return;
        }
        
        // Log action for audit trail
        await window.subscriptionManager.logAction('make_card_live', {
            card_id: cardId,
            restaurant_slug: restaurantSlug,
            tier: window.subscriptionManager.getCurrentTier()
        });
        
        // Generate unique QR code
        const qrCode = generateUniqueQRCode(restaurantSlug);
        
        // Update card status and add QR code
        const { error } = await supabase
            .from('loyalty_cards')
            .update({
                campaign_status: 'live',
                is_active: true,
                discovery_qr_code: qrCode,
                campaign_start_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', cardId);
        
        if (error) throw error;
        
        // Show QR code modal
        const { data: card } = await supabase
            .from('loyalty_cards')
            .select('*')
            .eq('id', cardId)
            .single();
            
        if (card) {
            showQRCode(cardId, qrCode, card.display_name);
        }
        
        // Reload cards
        loadMyCards();
        
    } catch (error) {
        console.error('Error making card live:', error);
        alert('Error making card live: ' + error.message);
    }
}

/**
 * Show QR code modal
 */
function showQRCode(cardId, qrCode, cardName) {
    console.log('showQRCode called');
    
    // First, remove any global click handlers temporarily
    const oldClickHandler = document.onclick;
    document.onclick = null;
    
    const modal = document.getElementById('qr-modal');
    const canvas = document.getElementById('qr-canvas');
    
    if (!modal || !canvas) {
        console.error('QR modal or canvas not found');
        return;
    }
    
    // Set card info
    document.getElementById('qr-card-name').textContent = cardName || 'Loyalty Card';
    document.getElementById('qr-code-value').textContent = qrCode;
    
    // Get restaurant name
    const restaurantName = document.getElementById('restaurant-name').textContent;
    document.getElementById('qr-restaurant-name').textContent = restaurantName;
    
    // Generate QR code
    const qrUrl = `https://tommasotiezzi.github.io/fideltyapp/programs/?qr=${qrCode}`;
    
    QRCode.toCanvas(canvas, qrUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, function (error) {
        if (error) console.error(error);
    });
    
    // Store current QR data for download
    window.currentQRData = {
        cardId,
        qrCode,
        cardName,
        restaurantName,
        url: qrUrl
    };
    
    // Make absolutely sure modal stays visible
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '99999';
    
    // Stop any animations or transitions
    modal.style.transition = 'none';
    modal.style.animation = 'none';
    
    // Prevent body scroll (but store original value)
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Add event handlers after a delay
    setTimeout(() => {
        // Add backdrop click handler
        modal.onclick = (e) => {
            if (e.target === modal) {
                console.log('QR modal backdrop clicked');
                window.closeQRModal();
            }
        };
        
        // Store original overflow for restoration
        modal.dataset.originalOverflow = originalOverflow || '';
        
        // Restore document click handler after delay
        if (oldClickHandler) {
            setTimeout(() => {
                document.onclick = oldClickHandler;
            }, 100);
        }
    }, 100);
    
    console.log('QR modal should be visible now');
}

/**
 * Close QR modal
 */
window.closeQRModal = function() {
    const modal = document.getElementById('qr-modal');
    if (modal) {
        modal.style.display = 'none';
        
        // Restore original overflow value or clear it
        const originalOverflow = modal.dataset.originalOverflow;
        if (originalOverflow !== undefined) {
            document.body.style.overflow = originalOverflow;
        } else {
            document.body.style.overflow = '';
        }
        
        // Clear any other potential blocking styles
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.documentElement.style.overflow = '';
        
        // Clear the stored value
        delete modal.dataset.originalOverflow;
    }
    console.log('QR modal closed and scrolling restored')};

/**
 * Download QR code as image
 */
window.downloadQRCode = function() {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas || !window.currentQRData) return;
    
    // Create a new canvas with branding
    const downloadCanvas = document.createElement('canvas');
    const ctx = downloadCanvas.getContext('2d');
    
    // Set canvas size
    downloadCanvas.width = 400;
    downloadCanvas.height = 500;
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
    
    // Add title
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(window.currentQRData.restaurantName, 200, 40);
    
    // Add subtitle
    ctx.font = '16px Inter';
    ctx.fillStyle = '#666';
    ctx.fillText('Loyalty Card', 200, 70);
    
    // Draw QR code
    ctx.drawImage(canvas, 50, 90, 300, 300);
    
    // Add instructions
    ctx.font = '14px Inter';
    ctx.fillStyle = '#333';
    ctx.fillText('Scan to get your digital loyalty card', 200, 420);
    
    // Add code
    ctx.font = 'bold 12px Inter';
    ctx.fillStyle = '#999';
    ctx.fillText(`Code: ${window.currentQRData.qrCode}`, 200, 450);
    
    // Download
    const link = document.createElement('a');
    link.download = `loyalty-qr-${window.currentQRData.qrCode}.png`;
    link.href = downloadCanvas.toDataURL();
    link.click();
}

/**
 * Show custom confirmation modal
 */
function showConfirmModal(title, message, confirmText, onConfirm, type = 'primary') {
    // Remove any existing modals
    const existingModal = document.getElementById('confirm-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const typeColors = {
        primary: '#7c5ce6',
        warning: '#f59e0b',
        danger: '#ef4444'
    };
    
    const color = typeColors[type] || typeColors.primary;
    
    // Create modal HTML
    const modalHtml = `
        <div class="confirm-modal" id="confirm-modal">
            <div class="confirm-modal-backdrop"></div>
            <div class="confirm-modal-content">
                <div class="confirm-modal-icon" style="color: ${color};">
                    ${type === 'danger' ? 
                        `<svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>` :
                        `<svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>`
                    }
                </div>
                <h3 class="confirm-modal-title">${title}</h3>
                <p class="confirm-modal-message">${message}</p>
                <div class="confirm-modal-actions">
                    <button class="confirm-modal-cancel" onclick="closeConfirmModal()">Cancel</button>
                    <button class="confirm-modal-confirm" style="background-color: ${color};" onclick="confirmModalAction()">
                        ${confirmText}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Store the confirm action
    window.confirmModalAction = () => {
        closeConfirmModal();
        onConfirm();
    };
    
    // Add escape key listener
    document.addEventListener('keydown', handleModalEscape);
}

/**
 * Close confirmation modal
 */
window.closeConfirmModal = function() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 200);
        document.removeEventListener('keydown', handleModalEscape);
    }
}

/**
 * Handle escape key for modal
 */
function handleModalEscape(e) {
    if (e.key === 'Escape') {
        closeConfirmModal();
    }
}

/**
 * Edit card - navigate to create card section in edit mode
 */
async function editCard(cardId) {
    console.log('Editing card:', cardId);
    
    try {
        // Fetch card data
        const { data: card, error } = await supabase
            .from('loyalty_cards')
            .select('*')
            .eq('id', cardId)
            .single();
        
        if (error) throw error;
        
        // Check if card is still draft
        if (card.is_active || card.campaign_status === 'live') {
            alert('Live cards cannot be edited');
            return;
        }
        
        // Store card ID for editing
        sessionStorage.setItem('editingCardId', cardId);
        
        // Navigate to Create Card section
        document.querySelector('[data-section="create-card"]').click();
        
        // Load card data for editing
        if (typeof loadCardForEditing === 'function') {
            loadCardForEditing(card);
        }
        
    } catch (error) {
        console.error('Error loading card for edit:', error);
        alert('Error loading card for editing');
    }
}

/**
 * Delete card (only for draft cards)
 */
async function deleteCard(cardId) {
    console.log('Deleting card:', cardId);
    
    try {
        // First check if card is draft
        const { data: card, error: checkError } = await supabase
            .from('loyalty_cards')
            .select('is_active, campaign_status')
            .eq('id', cardId)
            .single();
            
        if (checkError) throw checkError;
        
        if (card.is_active || card.campaign_status === 'live') {
            alert('Live cards cannot be deleted');
            return;
        }
        
        // Log action for audit
        await window.subscriptionManager.logAction('delete_card', {
            card_id: cardId,
            tier: window.subscriptionManager.getCurrentTier()
        });
        
        // Soft delete
        const { error } = await supabase
            .from('loyalty_cards')
            .update({
                deleted_at: new Date().toISOString()
            })
            .eq('id', cardId);
        
        if (error) throw error;
        
        // Remove card from DOM
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElement) {
            cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.9)';
            setTimeout(() => cardElement.remove(), 300);
        }
        
        // Check if any cards left
        const remainingCards = document.querySelectorAll('.card-item');
        if (remainingCards.length === 1) { // The one being deleted
            const noCardsState = document.getElementById('no-cards');
            if (noCardsState) {
                setTimeout(() => {
                    noCardsState.style.display = 'flex';
                }, 350);
            }
        }
        
        // Update usage indicator
        setTimeout(() => displayCardUsageIndicator(), 400);
        
    } catch (error) {
        console.error('Error deleting card:', error);
        alert('Error deleting card');
    }
}

/**
 * Filter cards by search query
 */
function filterCards(query) {
    const cards = document.querySelectorAll('.card-item');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const name = card.dataset.name || '';
        
        if (name.includes(query.toLowerCase())) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * Filter cards by status
 */
function filterCardsByStatus(status) {
    const cards = document.querySelectorAll('.card-item');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const cardStatus = card.dataset.status;
        
        if (status === 'all' || cardStatus === status) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * Helper function to adjust color brightness
 */
function adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return (usePound ? '#' : '') + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Debounce helper function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeMyCards,
        loadMyCards,
        editCard,
        deleteCard,
        filterCards,
        filterCardsByStatus,
        displayCardUsageIndicator
    };
}