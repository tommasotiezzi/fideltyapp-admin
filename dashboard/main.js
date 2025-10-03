// main.js - Main dashboard controller with tier system and role-based access

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    // CRITICAL: Verify authentication and role FIRST
    const isAuthorized = await verifyUserAccess();
    if (!isAuthorized) {
        return; // Stop all initialization if not authorized
    }
    
    // Initialize subscription manager
    await initializeSubscriptionManager();
    
    // Force refresh subscription status from database
    await refreshSubscriptionStatus();
    
    // Check for monthly reset
    await checkMonthlyReset();
    
    // Initialize navigation with role-based visibility
    initializeNavigation();
    
    // Initialize feature managers based on role
    await initializeFeatureManagers();
    
    // Navigate to first available section
    const firstNavItem = document.querySelector('.nav-item');
    if (firstNavItem) {
        firstNavItem.click();
    }
    
    // Load restaurant data
    await loadRestaurantData();
    
    // Setup role-based UI
    setupRoleBasedUI();
    
    // Initialize stamps grid
    if (typeof updateStampsGrid === 'function') {
        updateStampsGrid(10);
    }
    
    // Setup CTA buttons
    setupCTAButtons();
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Set up periodic subscription check (every 5 minutes)
    setInterval(async () => {
        await refreshSubscriptionStatus();
        await checkMonthlyReset();
    }, 5 * 60 * 1000);
});

/**
 * Verify user is authenticated and has proper role (owner or staff)
 * @returns {Promise<boolean>} - True if authorized, false otherwise
 */
async function verifyUserAccess() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase not loaded');
        redirectToLogin('Supabase client not initialized');
        return false;
    }
    
    try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            redirectToLogin('No valid session found');
            return false;
        }
        
        // Check user role (owner or staff)
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role, restaurant_id, can_view_billing')
            .eq('user_id', session.user.id)
            .in('role', ['owner', 'staff'])
            .single();
        
        if (roleError || !roleData) {
            console.error('User does not have proper role:', roleError);
            
            // Check if this is a staff member via authorized_emails
            const { data: restaurants } = await supabase
                .from('restaurants')
                .select('id, authorized_emails')
                .contains('authorized_emails', [session.user.email]);
            
            if (restaurants && restaurants.length > 0) {
                // User is authorized staff
                sessionStorage.setItem('userRole', 'staff');
                sessionStorage.setItem('restaurantId', restaurants[0].id);
                sessionStorage.setItem('userPermissions', JSON.stringify({
                    can_view_billing: false
                }));
                console.log('Staff access verified');
                return true;
            }
            
            await supabase.auth.signOut();
            redirectToLogin('Access denied. Only restaurant owners and authorized staff can access this dashboard.');
            return false;
        }
        
        // Store role and permissions
        sessionStorage.setItem('userRole', roleData.role);
        sessionStorage.setItem('restaurantId', roleData.restaurant_id);
        sessionStorage.setItem('userPermissions', JSON.stringify({
            can_view_billing: roleData.can_view_billing || roleData.role === 'owner'
        }));
        
        console.log(`${roleData.role} access verified`);
        return true;
        
    } catch (error) {
        console.error('Authorization check failed:', error);
        redirectToLogin('Authorization failed');
        return false;
    }
}

/**
 * Initialize subscription manager
 */
async function initializeSubscriptionManager() {
    if (!window.subscriptionManager) {
        console.error('Subscription manager not loaded');
        return;
    }
    
    // Initialize subscription manager
    console.log('Initializing subscription manager...');
    
    // Load initial tier data
    const tier = window.subscriptionManager.getCurrentTier();
    console.log(`Current tier: ${tier}`);
    
    // Update badge immediately
    window.subscriptionManager.updateSubscriptionBadge();
}

/**
 * Check if monthly reset is needed
 */
async function checkMonthlyReset() {
    if (!window.subscriptionManager) return;
    
    const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
    if (!restaurant.subscription_started_at) return;
    
    await window.subscriptionManager.checkMonthlyReset(restaurant);
}

/**
 * Setup role-based UI visibility
 */
function setupRoleBasedUI() {
    const userRole = sessionStorage.getItem('userRole');
    const permissions = JSON.parse(sessionStorage.getItem('userPermissions') || '{}');
    
    if (userRole === 'staff') {
        // Hide settings if staff doesn't have billing permission
        if (!permissions.can_view_billing) {
            const settingsNav = document.querySelector('[data-section="settings"]');
            if (settingsNav) {
                settingsNav.style.display = 'none';
            }
        }
        
        // Add staff badge to header
        const header = document.querySelector('.sidebar-header');
        if (header) {
            const staffBadge = document.createElement('div');
            staffBadge.className = 'staff-badge';
            staffBadge.innerHTML = `
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Staff Member
            `;
            staffBadge.style.cssText = `
                background: #e5e7eb;
                color: #4b5563;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 8px;
            `;
            header.appendChild(staffBadge);
        }
        
        // Log all staff actions
        document.addEventListener('click', async (e) => {
            const actionElement = e.target.closest('[data-action]');
            if (actionElement) {
                await window.subscriptionManager.logAction('staff_action', {
                    action: actionElement.dataset.action,
                    element: actionElement.tagName
                });
            }
        });
    }
}

/**
 * Initialize feature managers
 */
async function initializeFeatureManagers() {
    // Initialize card designer
    if (typeof initializeCardDesigner === 'function') {
        initializeCardDesigner();
    }
    
    // Initialize My Cards section with usage indicators
    if (typeof initializeMyCards === 'function') {
        initializeMyCards();
    }
    
    // Initialize promotions manager if available
    if (window.promotionsManager) {
        await window.promotionsManager.init();
    }
    
    // Initialize events manager if available
    if (window.eventsManager) {
        await window.eventsManager.init();
    }
    
    // Initialize notifications manager if available
    if (window.notificationsManager) {
        await window.notificationsManager.init();
    }
}

/**
 * Redirect to login page with optional message
 */
function redirectToLogin(message) {
    if (message) {
        sessionStorage.setItem('loginMessage', message);
    }
    window.location.href = '/auth/login.html';
}

/**
 * Refresh subscription status from database with monthly reset check
 */
async function refreshSubscriptionStatus() {
    try {
        if (!window.subscriptionManager) {
            console.warn('Subscription manager not loaded');
            return;
        }
        
        // Force refresh from database
        await window.subscriptionManager.refreshSubscriptionStatus();
        
        // Check if monthly reset is needed
        await checkMonthlyReset();
        
        // Update all usage indicators
        await updateAllUsageIndicators();
        
        console.log('Subscription status refreshed');
        
    } catch (error) {
        console.error('Error refreshing subscription:', error);
    }
}

/**
 * Update all usage indicators across sections
 */
async function updateAllUsageIndicators() {
    // Update cards usage
    if (typeof displayCardUsageIndicator === 'function') {
        await displayCardUsageIndicator();
    }
    
    // Update promotions usage
    if (window.promotionsManager && window.promotionsManager.displayUsageIndicator) {
        await window.promotionsManager.displayUsageIndicator();
    }
    
    // Update events usage
    if (window.eventsManager && window.eventsManager.displayUsageIndicator) {
        await window.eventsManager.displayUsageIndicator();
    }
    
    // Update notifications usage
    if (window.notificationsManager && window.notificationsManager.displayUsageIndicator) {
        window.notificationsManager.displayUsageIndicator();
    }
}

/**
 * Initialize sidebar navigation with subscription checks and role-based access
 */
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const userRole = sessionStorage.getItem('userRole');
    const permissions = JSON.parse(sessionStorage.getItem('userPermissions') || '{}');

        // In initializeNavigation() or after DOM load
    const tier = window.subscriptionManager?.getCurrentTier() || 'free';
    if (tier === 'free') {
        const notificationsNav = document.querySelector('[data-section="notifications"]');
        if (notificationsNav) {
            notificationsNav.style.display = 'none';
        }
    }
    
    navItems.forEach(item => {
        item.addEventListener('click', async () => {
            const targetSection = item.dataset.section;
            
            // Check if staff has access to settings
            if (targetSection === 'settings' && userRole === 'staff' && !permissions.can_view_billing) {
                alert('You do not have permission to access billing settings.');
                return;
            }
            
            // Update active states
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            sections.forEach(section => section.classList.remove('active'));
            const targetElement = document.getElementById(`${targetSection}-section`);
            
            if (targetElement) {
                targetElement.classList.add('active');
                
                // Load section-specific content with fresh data
                switch(targetSection) {
                    
                    case 'my-cards':
                        if (typeof loadMyCards === 'function') {
                            await loadMyCards();
                        }
                        // Update cards usage indicator
                        if (typeof displayCardUsageIndicator === 'function') {
                            await displayCardUsageIndicator();
                        }
                        break;
                    
                    case 'create-card':
                        resetCardDesignForm();
                        // Show tier-specific note
                        await showTierSpecificCardNote();
                        break;
                    
                    case 'promotions':
                        if (window.promotionsManager) {
                            await window.promotionsManager.loadPromotions();
                        }
                        break;
                    
                    case 'events':
                        if (window.eventsManager) {
                            await window.eventsManager.loadEvents();
                        }
                        break;
                    
                    case 'notifications':
                        if (window.notificationsManager) {
                            await window.notificationsManager.loadNotifications();
                        }
                        break;
                    
                    case 'analytics':
                        await loadAnalytics();
                        break;
                    
                    case 'settings':
                        // ALWAYS refresh subscription when entering settings
                        await refreshSubscriptionStatus();
                        await initializeSettings();
                        break;
                }
                
                // Log navigation for staff
                if (userRole === 'staff') {
                    await window.subscriptionManager.logAction('navigate', {
                        section: targetSection
                    });
                }
            }
        });
    });
    
    // Logout button with cleanup
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                // Log logout action
                if (window.subscriptionManager) {
                    await window.subscriptionManager.logAction('logout', {
                        role: userRole
                    });
                }
                
                // Clear all session data
                sessionStorage.clear();
                localStorage.removeItem('rememberedEmail');
                
                // Sign out from Supabase
                if (typeof supabase !== 'undefined') {
                    await supabase.auth.signOut();
                }
                
                // Redirect to login
                window.location.href = '/auth/login.html';
                
            } catch (error) {
                console.error('Logout error:', error);
                // Force redirect anyway
                window.location.href = '/auth/login.html';
            }
        });
    }
}

/**
 * Load dashboard with usage summary
 */
async function loadDashboard() {
    console.log('Loading dashboard...');
    
    const dashboardSection = document.getElementById('dashboard-section');
    if (!dashboardSection) return;
    
    const tier = window.subscriptionManager.getCurrentTier();
    const tierConfig = window.subscriptionManager.getTierConfig();
    const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
    
    // Create dashboard summary
    const summaryHtml = `
        <div class="dashboard-header">
            <h1>Welcome back!</h1>
            <div class="tier-summary">
                <span class="tier-badge ${tier}">${tier.toUpperCase()} PLAN</span>
                ${tier === 'free' ? `
                    <button class="upgrade-cta" onclick="window.subscriptionManager.showUpgradeModal('dashboard', 'basic')">
                        Upgrade to Go Live
                    </button>
                ` : ''}
            </div>
        </div>
        
        <div class="usage-summary-grid">
            <div class="usage-summary-card">
                <h3>Loyalty Cards</h3>
                <div class="usage-metric">
                    <span class="current">0</span>
                    <span class="separator">/</span>
                    <span class="limit">${tierConfig.maxLiveCards === 999 ? '∞' : tierConfig.maxLiveCards}</span>
                </div>
                <p>Live Cards</p>
            </div>
            
            <div class="usage-summary-card">
                <h3>Promotions</h3>
                <div class="usage-metric">
                    <span class="current">0</span>
                    <span class="separator">/</span>
                    <span class="limit">${tierConfig.maxLivePromotions === 999 ? '∞' : tierConfig.maxLivePromotions}</span>
                </div>
                <p>Active Promotions</p>
            </div>
            
            <div class="usage-summary-card">
                <h3>Events</h3>
                <div class="usage-metric">
                    <span class="current">0</span>
                    <span class="separator">/</span>
                    <span class="limit">${tierConfig.maxLiveEvents === 999 ? '∞' : tierConfig.maxLiveEvents}</span>
                </div>
                <p>Active Events</p>
            </div>
            
            <div class="usage-summary-card">
                <h3>Notifications</h3>
                <div class="usage-metric">
                    <span class="current">${restaurant.notifications_sent_this_month || 0}</span>
                    <span class="separator">/</span>
                    <span class="limit">${tierConfig.maxNotificationsPerMonth === 999 ? '∞' : tierConfig.maxNotificationsPerMonth}</span>
                </div>
                <p>Sent This Month</p>
            </div>
        </div>
    `;
    
    // Update dashboard content
    const existingContent = dashboardSection.querySelector('.dashboard-content');
    if (existingContent) {
        existingContent.innerHTML = summaryHtml;
    }
    
    // Load actual counts
    await updateDashboardMetrics();
}

/**
 * Update dashboard metrics with actual counts
 */
async function updateDashboardMetrics() {
    try {
        const restaurantId = window.subscriptionManager.getRestaurantId();
        
        // Get live cards count - check both is_active and campaign_status
        const { data: cards } = await supabase
            .from('loyalty_cards')
            .select('id, campaign_status')
            .eq('restaurant_id', restaurantId)
            .is('deleted_at', null);
        
        // Filter for truly live cards (either is_active=true OR campaign_status='live')
        const liveCards = cards?.filter(card => 
            card.campaign_status === 'live'
        ) || [];
        
        // Get active promotions count
        const { data: promotions } = await supabase
            .from('promotions')
            .select('id', { count: 'exact' })
            .eq('restaurant_id', restaurantId)
            .eq('status', 'active');
        
        // Get active events count
        const today = new Date().toISOString().split('T')[0];
        const { data: events } = await supabase
            .from('events')
            .select('id', { count: 'exact' })
            .eq('restaurant_id', restaurantId)
            .eq('status', 'active')
            .gte('event_date', today);
        
        // Update UI
        const metrics = document.querySelectorAll('.usage-metric .current');
        if (metrics[0]) metrics[0].textContent = liveCardsCount;
        if (metrics[1]) metrics[1].textContent = promotions?.length || 0;
        if (metrics[2]) metrics[2].textContent = events?.length || 0;
        
    } catch (error) {
        console.error('Error updating dashboard metrics:', error);
    }
}

/**
 * Load restaurant data with subscription status
 */
async function loadRestaurantData() {
    try {
        if (typeof supabase === 'undefined') {
            console.error('Supabase not available');
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            redirectToLogin('User session expired');
            return;
        }
        
        const userRole = sessionStorage.getItem('userRole');
        let restaurant;
        
        if (userRole === 'owner') {
            // Owner: fetch by owner_id
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('owner_id', user.id)
                .single();
            
            if (error || !data) {
                console.error('Restaurant not found:', error);
                alert('Restaurant configuration not found. Please contact support.');
                return;
            }
            restaurant = data;
        } else {
            // Staff: fetch by restaurant_id from session
            const restaurantId = sessionStorage.getItem('restaurantId');
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurantId)
                .single();
            
            if (error || !data) {
                console.error('Restaurant not found:', error);
                alert('Restaurant configuration not found. Please contact support.');
                return;
            }
            restaurant = data;
        }
        
        // Store complete restaurant data including subscription
        sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
        
        // Update UI with restaurant data
        updateUIWithRestaurantData(restaurant);
        
        // Update subscription badge
        if (window.subscriptionManager) {
            window.subscriptionManager.updateSubscriptionBadge();
        }
        
        console.log('Restaurant data loaded:', {
            name: restaurant.name,
            tier: restaurant.subscription_tier,
            role: userRole
        });
        
    } catch (error) {
        console.error('Error loading restaurant data:', error);
    }
}

/**
 * Update UI with restaurant data
 */
function updateUIWithRestaurantData(restaurant) {
    // Update restaurant name in sidebar
    const restaurantNameEl = document.getElementById('restaurant-name');
    if (restaurantNameEl) {
        restaurantNameEl.textContent = restaurant.name;
    }
    
    // Update restaurant name in settings
    const restaurantNameInput = document.getElementById('restaurant-name-input');
    if (restaurantNameInput) {
        restaurantNameInput.value = restaurant.name;
    }
    
    // Update address in settings
    const restaurantAddress = document.getElementById('restaurant-address');
    if (restaurantAddress && restaurant.address) {
        restaurantAddress.value = restaurant.address;
    }
    
    // Set default display name in card designer
    const displayNameInput = document.getElementById('display-name');
    if (displayNameInput && !displayNameInput.value) {
        displayNameInput.value = restaurant.name;
        const titlePreview = document.getElementById('title-preview');
        if (titlePreview) {
            titlePreview.textContent = restaurant.name;
        }
    }
    
    // Update subscription badge
    const subscriptionBadge = document.querySelector('.subscription-badge');
    if (subscriptionBadge) {
        const tier = restaurant.subscription_tier || 'free';
        const tierConfig = window.subscriptionManager?.getTierConfig(tier) || {};
        
        subscriptionBadge.style.background = tierConfig.badgeColor || '#e5e7eb';
        subscriptionBadge.style.color = tierConfig.textColor || '#4b5563';
        
        const badgeText = subscriptionBadge.querySelector('.badge-text');
        if (badgeText) {
            badgeText.textContent = tierConfig.displayName || 'Free Plan';
        }
    }
}

/**
 * Show tier-specific note when creating cards
 */
async function showTierSpecificCardNote() {
    const tier = window.subscriptionManager?.getCurrentTier() || 'free';
    const tierConfig = window.subscriptionManager?.getTierConfig() || {};
    
    const createBtn = document.getElementById('create-card-btn');
    if (!createBtn) return;
    
    // Remove existing note
    const existingNote = document.querySelector('.tier-plan-note');
    if (existingNote) existingNote.remove();
    
    let noteHtml = '';
    
    if (tier === 'free') {
        noteHtml = `
            <div class="tier-plan-note free">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <strong>Free Plan:</strong> You can create and preview cards, but need to upgrade to make them live and generate QR codes.
                <button class="upgrade-link" onclick="window.subscriptionManager.showUpgradeModal('cards', 'basic')">
                    Upgrade Now →
                </button>
            </div>
        `;
    } else {
        const { data: liveCards } = await supabase
            .from('loyalty_cards')
            .select('id', { count: 'exact' })
            .eq('restaurant_id', window.subscriptionManager.getRestaurantId())
            .eq('is_active', true)
            .is('deleted_at', null);
        
        const currentCount = liveCards?.length || 0;
        const remaining = tierConfig.maxLiveCards - currentCount;
        
        if (remaining <= 0 && tier !== 'enterprise') {
            noteHtml = `
                <div class="tier-plan-note limit">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <strong>Card Limit Reached:</strong> You've used all ${tierConfig.maxLiveCards} live card slots.
                    <button class="upgrade-link" onclick="window.subscriptionManager.showUpgradeModal('cards', '${tier === 'basic' ? 'premium' : 'enterprise'}')">
                        Upgrade for More →
                    </button>
                </div>
            `;
        } else if (remaining === 1) {
            noteHtml = `
                <div class="tier-plan-note warning">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <strong>Last Card Slot:</strong> You have 1 remaining live card slot on your ${tierConfig.displayName} plan.
                </div>
            `;
        }
    }
    
    if (noteHtml) {
        const note = document.createElement('div');
        note.innerHTML = noteHtml;
        createBtn.parentElement.appendChild(note.firstElementChild);
    }
    
    // Add CSS if not exists
    if (!document.getElementById('tier-note-styles')) {
        const style = document.createElement('style');
        style.id = 'tier-note-styles';
        style.textContent = `
            .tier-plan-note {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                margin-top: 1rem;
                border-radius: 8px;
                font-size: 0.875rem;
            }
            .tier-plan-note.free {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                color: #92400e;
            }
            .tier-plan-note.warning {
                background: #fed7aa;
                border: 1px solid #ea580c;
                color: #7c2d12;
            }
            .tier-plan-note.limit {
                background: #fee2e2;
                border: 1px solid #ef4444;
                color: #991b1b;
            }
            .upgrade-link {
                margin-left: auto;
                background: none;
                border: none;
                color: inherit;
                font-weight: 600;
                cursor: pointer;
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Load analytics with subscription check
 */
async function loadAnalytics() {
    console.log('Loading analytics...');
    
    // CRITICAL: Check if user has analytics access
    const tier = window.subscriptionManager?.getCurrentTier() || 'free';
    const hasAccess = tier === 'premium' || tier === 'enterprise';
    
    if (!hasAccess) {
        console.log('Analytics access restricted - Premium/Enterprise only');
    }
    
    // Refresh subscription to ensure accurate data
    await refreshSubscriptionStatus();
    
    // Initialize analytics module - it will handle access control internally
    if (window.analyticsModule && window.analyticsModule.initializeAnalytics) {
        await window.analyticsModule.initializeAnalytics();
    } else {
        console.error('Analytics module not found or not properly loaded');
    }
}

/**
 * Initialize settings section with fresh subscription data
 */
async function initializeSettings() {
    console.log('Initializing settings...');
    
    const userRole = sessionStorage.getItem('userRole');
    const permissions = JSON.parse(sessionStorage.getItem('userPermissions') || '{}');
    
    // Check if user can view billing
    if (userRole === 'staff' && !permissions.can_view_billing) {
        const settingsSection = document.getElementById('settings-section');
        if (settingsSection) {
            settingsSection.innerHTML = `
                <div class="permission-denied">
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <h2>Access Restricted</h2>
                    <p>You don't have permission to view billing settings.</p>
                    <p>Please contact your restaurant owner for access.</p>
                </div>
            `;
        }
        return;
    }
    
    try {
        // CRITICAL: Always fetch fresh restaurant data for settings
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        let restaurant;
        
        if (userRole === 'owner') {
            const { data } = await supabase
                .from('restaurants')
                .select('*')
                .eq('owner_id', user.id)
                .single();
            restaurant = data;
        } else {
            const restaurantId = sessionStorage.getItem('restaurantId');
            const { data } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', restaurantId)
                .single();
            restaurant = data;
        }
        
        if (restaurant) {
            // Update session with fresh data
            sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
        }
        
        // Initialize settings-billing with fresh data
        if (window.settingsBilling) {
            await window.settingsBilling.init();
        }
        
    } catch (error) {
        console.error('Error initializing settings:', error);
    }
}

/**
 * Reset card design form
 */
function resetCardDesignForm() {
    const displayNameInput = document.getElementById('display-name');
    const titlePreview = document.getElementById('title-preview');
    
    // Set default from restaurant name
    const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
    if (displayNameInput && restaurant.name) {
        displayNameInput.value = restaurant.name;
    }
    if (titlePreview && restaurant.name) {
        titlePreview.textContent = restaurant.name;
    }
    
    // Clear location
    const locationInput = document.getElementById('location-name');
    const locationSubtitle = document.getElementById('location-subtitle');
    const showLocationCheckbox = document.getElementById('show-location');
    if (locationInput) locationInput.value = '';
    if (locationSubtitle) {
        locationSubtitle.textContent = '';
        locationSubtitle.style.display = 'none';
    }
    if (showLocationCheckbox) showLocationCheckbox.checked = false;
    
    // Clear background image
    const bgImagePreview = document.getElementById('bg-image-preview');
    const opacityControl = document.getElementById('opacity-control');
    if (bgImagePreview) {
        bgImagePreview.src = '';
        bgImagePreview.style.display = 'none';
    }
    if (opacityControl) {
        opacityControl.style.display = 'none';
    }
    
    // Reset other fields
    const bgColorInput = document.getElementById('bg-color');
    if (bgColorInput) bgColorInput.value = '#7c5ce6';
    
    const stampsSelect = document.getElementById('stamps-required');
    if (stampsSelect) stampsSelect.value = '10';
    
    const rewardInput = document.getElementById('reward-text');
    if (rewardInput) rewardInput.value = 'Free Pizza';
    
    // Clear stored editing ID
    sessionStorage.removeItem('editingCardId');
    
    // Update stamps grid
    if (typeof updateStampsGrid === 'function') {
        updateStampsGrid(10);
    }
}

/**
 * Setup CTA buttons
 */
function setupCTAButtons() {
    const createCardCTA = document.getElementById('create-card-cta');
    if (createCardCTA) {
        createCardCTA.addEventListener('click', () => {
            document.querySelector('[data-section="create-card"]')?.click();
        });
    }
    
    const createAnotherBtn = document.getElementById('create-another-btn');
    if (createAnotherBtn) {
        createAnotherBtn.addEventListener('click', () => {
            closeSuccessModal();
        });
    }
    
    const goToMyCardsBtn = document.getElementById('go-to-my-cards-btn');
    if (goToMyCardsBtn) {
        goToMyCardsBtn.addEventListener('click', () => {
            goToMyCards();
        });
    }
}

/**
 * Initialize mobile menu
 */
function initializeMobileMenu() {
    const menuToggle = document.createElement('button');
    menuToggle.className = 'mobile-menu-toggle';
    menuToggle.innerHTML = `
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
    `;
    menuToggle.style.cssText = `
        display: none;
        position: fixed;
        top: 1rem;
        left: 1rem;
        z-index: 1000;
        padding: 0.5rem;
        background: white;
        border: 1px solid #e5e5e7;
        border-radius: 8px;
        cursor: pointer;
    `;
    
    document.body.appendChild(menuToggle);
    
    menuToggle.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar?.classList.toggle('open');
    });
    
    // Handle responsive display
    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    function handleMobileChange(e) {
        menuToggle.style.display = e.matches ? 'block' : 'none';
    }
    
    mediaQuery.addEventListener('change', handleMobileChange);
    handleMobileChange(mediaQuery);
}

/**
 * Helper: Adjust color brightness
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
 * Helper: Validate email
 */
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Modal functions
window.closeSuccessModal = function() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('modal-active');
        document.body.style.overflow = ''; // Restore scrolling
        resetCardDesignForm();
    }
}

window.goToMyCards = function() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('modal-active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    // Navigate to My Cards section
    const myCardsNav = document.querySelector('[data-section="my-cards"]');
    if (myCardsNav) {
        myCardsNav.click();
    }
}
// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        verifyUserAccess,
        refreshSubscriptionStatus,
        loadRestaurantData,
        initializeSettings,
        validateEmail,
        adjustColor,
        checkMonthlyReset,
        updateAllUsageIndicators
    };
}