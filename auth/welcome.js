// welcome.js - Fixed authentication with proper restaurant creation before checkout
let selectedPlan = null;
let needsCheckout = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeForms();
    checkExistingSession();
    
    // Check if coming from landing with pre-selected plan
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedPlan = urlParams.get('plan');
    if (preselectedPlan && ['basic', 'premium'].includes(preselectedPlan)) {
        setTimeout(() => openAuthModal('signup', preselectedPlan), 500);
    }
});

/**
 * Check if user is already logged in
 */
async function checkExistingSession() {
    if (typeof supabase === 'undefined') return;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // Load restaurant data before redirecting
            await loadRestaurantData(session.user.id);
            window.location.href = '/dashboard/index.html';
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

/**
 * Load restaurant data for authenticated user
 */
async function loadRestaurantData(userId) {
    try {
        // Get restaurant by owner_id
        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', userId)
            .single();
        
        if (restaurant) {
            sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
            sessionStorage.setItem('userRole', 'owner');
        }
    } catch (error) {
        console.error('Error loading restaurant data:', error);
    }
}

/**
 * Initialize form handlers
 */
function initializeForms() {
    // Signup form
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Load saved email for login
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        const loginEmailInput = document.getElementById('login-email');
        const rememberCheckbox = document.getElementById('remember');
        if (loginEmailInput) loginEmailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }
}

/**
 * Open auth modal
 */
function openAuthModal(mode = 'signup', plan = 'free') {
    selectedPlan = plan;
    needsCheckout = (plan !== 'free');
    
    const modal = document.getElementById('authModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    switchTab(mode);
}

/**
 * Close auth modal
 */
function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    clearMessages();
}

/**
 * Close modal when clicking backdrop
 */
function closeModalOnBackdrop(event) {
    if (event.target === event.currentTarget) {
        closeAuthModal();
    }
}

/**
 * Switch between login and signup tabs
 */
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    const indicator = document.getElementById('tabIndicator');
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    if (tab === 'login') {
        indicator.classList.add('right');
        signupForm.classList.remove('active');
        loginForm.classList.add('active');
    } else {
        indicator.classList.remove('right');
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
    }
    
    clearMessages();
}

/**
 * Handle signup - FIXED VERSION
 */
async function handleSignup(e) {
    e.preventDefault();
    
    const form = e.target;
    const restaurantInput = document.getElementById('signup-restaurant');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    
    if (!restaurantInput.value.trim() || !emailInput.value.trim() || !passwordInput.value) {
        showError('Please fill in all fields.');
        return;
    }
    
    const submitBtn = form.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    submitBtn.disabled = true;
    
    try {
        const email = emailInput.value.trim();
        const restaurantName = restaurantInput.value.trim();
        const password = passwordInput.value;
        
        // Step 1: Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create account');
        
        // Step 2: IMPORTANT - Create restaurant record in database BEFORE checkout
        // This ensures the record exists when the webhook fires
        const slug = createSlug(restaurantName);
        
        const restaurantData = {
            name: restaurantName,
            slug: slug,
            owner_id: authData.user.id,
            subscription_tier: selectedPlan || 'free',
            subscription_status: selectedPlan === 'free' ? 'active' : 'pending_payment',
            activation_fee_paid: selectedPlan === 'free',
            notifications_sent_this_month: 0,
            active_promotions_count: 0,
            active_events_count: 0,
            authorized_emails: [email],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Add monthly billing date for paid plans (will be updated by webhook)
        if (selectedPlan !== 'free') {
            restaurantData.monthly_billing_date = new Date().getDate();
        }
        
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .insert(restaurantData)
            .select()
            .single();
        
        if (restaurantError) {
            console.error('Restaurant creation error:', restaurantError);
            // Try to clean up auth user
            await supabase.auth.signOut();
            throw new Error('Failed to create restaurant. Please contact support.');
        }
        
        console.log('Restaurant created:', restaurant);
        
        // Step 3: Create user role entry
        const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
                user_id: authData.user.id,
                restaurant_id: restaurant.id,
                role: 'owner',
                created_at: new Date().toISOString()
            });
        
        if (roleError) {
            console.error('Role creation error (non-fatal):', roleError);
            // Continue anyway - owner can still be identified by owner_id
        }
        
        // Step 4: Store data in session
        sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
        sessionStorage.setItem('userRole', 'owner');
        sessionStorage.setItem('selectedPlan', selectedPlan);
        
        showSuccess('Account created successfully!');
        
        // Step 5: Now proceed with checkout or dashboard
        // The restaurant record now exists in the database for the webhook to update
        setTimeout(() => {
            if (needsCheckout && selectedPlan !== 'free') {
                // Restaurant exists, safe to create checkout
                createStripeCheckout(selectedPlan, restaurant.id, email);
            } else {
                // Free plan, go straight to dashboard
                window.location.href = '/dashboard/index.html';
            }
        }, 1000);
        
    } catch (error) {
        console.error('Signup error:', error);
        showError(error.message || 'Signup failed. Please try again.');
        
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

/**
 * Handle login
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberCheckbox = document.getElementById('remember');
    
    const submitBtn = form.querySelector('.btn-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    submitBtn.disabled = true;
    
    try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        // Attempt login
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (authError) throw authError;
        
        // Get restaurant by owner_id (most reliable method)
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', authData.user.id)
            .single();
        
        if (restaurantError || !restaurant) {
            // Fallback: try through user_roles
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('restaurant_id')
                .eq('user_id', authData.user.id)
                .eq('role', 'owner')
                .single();
            
            if (!roleData) {
                await supabase.auth.signOut();
                throw new Error('Access denied. This dashboard is for restaurant owners only.');
            }
            
            // Get restaurant using role data
            const { data: restaurantByRole } = await supabase
                .from('restaurants')
                .select('*')
                .eq('id', roleData.restaurant_id)
                .single();
            
            if (!restaurantByRole) {
                await supabase.auth.signOut();
                throw new Error('Restaurant configuration not found. Please contact support.');
            }
            
            restaurant = restaurantByRole;
        }
        
        // Save email preference
        if (rememberCheckbox.checked) {
            localStorage.setItem('rememberedEmail', email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }
        
        // Store restaurant data
        sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
        sessionStorage.setItem('userRole', 'owner');
        
        showSuccess('Login successful!');
        
        setTimeout(() => {
            window.location.href = '/dashboard/index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please check your credentials.');
        
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

/**
 * Create Stripe checkout session
 * Restaurant must exist in database before calling this
 */
async function createStripeCheckout(planId, restaurantId, email) {
    try {
        showSuccess(`Setting up ${planId} plan checkout...`);
        
        console.log('Creating checkout for:', { planId, restaurantId, email });
        
        // Call your Vercel API to create Stripe checkout
        const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planId: planId,
                restaurantId: restaurantId,
                email: email
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create checkout session');
        }
        
        const { url } = await response.json();
        
        if (!url) {
            throw new Error('No checkout URL received');
        }
        
        console.log('Redirecting to Stripe checkout...');
        
        // Redirect to Stripe Checkout
        window.location.href = url;
        
    } catch (error) {
        console.error('Checkout error:', error);
        showError('Failed to create checkout. You can upgrade later from the dashboard.');
        
        // Still let them into the dashboard even if checkout fails
        setTimeout(() => {
            window.location.href = '/dashboard/index.html';
        }, 3000);
    }
}

/**
 * Create URL-safe slug from text
 */
function createSlug(text) {
    const random = Math.random().toString(36).substring(2, 10);
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) + '-' + random;
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (!errorDiv) return;
    
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    if (!successDiv) return;
    
    successDiv.textContent = message;
    successDiv.classList.add('show');
    
    setTimeout(() => {
        successDiv.classList.remove('show');
    }, 5000);
}

/**
 * Clear all messages
 */
function clearMessages() {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    
    errorDiv?.classList.remove('show');
    successDiv?.classList.remove('show');
}
