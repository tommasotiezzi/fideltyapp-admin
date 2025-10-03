// welcome.js - Combined authentication and checkout flow

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
            window.location.href = '/dashboard/index.html';
        }
    } catch (error) {
        console.error('Session check error:', error);
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
 * Handle signup
 */
async function handleSignup(e) {
    e.preventDefault();
    
    const form = e.target;
    const restaurantInput = document.getElementById('signup-restaurant');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    
    // Validate inputs
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
        
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    restaurant_name: restaurantName,
                    role_type: 'owner'
                }
            }
        });
        
        if (authError) throw authError;
        
        if (!authData.user) {
            throw new Error('Failed to create user account. Please try again.');
        }
        
        // Generate unique slug for restaurant
        const baseSlug = createSlug(restaurantName);
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const uniqueSlug = `${baseSlug}-${uniqueId}`;
        
        // Determine subscription status based on selected plan
        const subscriptionStatus = selectedPlan === 'free' ? 'free' : 'pending';
        
        // Create restaurant with owner email in authorized_emails
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .insert([{
                owner_id: authData.user.id,
                name: restaurantName,
                slug: uniqueSlug,
                subscription_status: subscriptionStatus,
                subscription_tier: selectedPlan,
                subscription_ends_at: null,
                authorized_emails: [email], // Add owner email to authorized list
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (restaurantError) {
            console.error('Restaurant creation error:', restaurantError);
            // Try to clean up the auth user
            await supabase.auth.signOut();
            throw new Error('Failed to create restaurant. Please contact support.');
        }
        
        // Create owner role
        const { error: roleError } = await supabase
            .from('user_roles')
            .insert([{
                user_id: authData.user.id,
                restaurant_id: restaurant.id,
                role: 'owner',
                created_at: new Date().toISOString()
            }]);
        
        if (roleError) {
            console.error('Role creation error:', roleError);
            // Don't fail - role might be created by database trigger
        }
        
        // Create default draft loyalty card
        await supabase
            .from('loyalty_cards')
            .insert([{
                restaurant_id: restaurant.id,
                display_name: restaurantName,
                stamps_required: 10,
                reward_text: 'Free Item',
                card_color: '#7c5ce6',
                text_color: '#FFFFFF',
                is_active: false,
                campaign_status: 'draft'
            }]);
        
        // Store restaurant data
        sessionStorage.setItem('restaurant', JSON.stringify(restaurant));
        sessionStorage.setItem('userRole', 'owner');
        sessionStorage.setItem('selectedPlan', selectedPlan);
        
        showSuccess('Account created successfully!');
        
        // Redirect based on plan
        setTimeout(() => {
            if (needsCheckout && selectedPlan !== 'free') {
                // Redirect to Stripe checkout
                createStripeCheckout(selectedPlan, restaurant.id);
            } else {
                // Redirect to dashboard
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
        
        // Verify owner role
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role, restaurant_id')
            .eq('user_id', authData.user.id)
            .eq('role', 'owner')
            .single();
        
        if (roleError || !roleData) {
            // Not an owner - immediately sign out
            await supabase.auth.signOut();
            throw new Error('Access denied. This dashboard is for restaurant owners only.');
        }
        
        // Verify restaurant exists and get subscription status
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', roleData.restaurant_id)
            .single();
        
        if (restaurantError || !restaurant) {
            await supabase.auth.signOut();
            throw new Error('Restaurant configuration not found. Please contact support.');
        }
        
        // Save email preference
        if (rememberCheckbox.checked) {
            localStorage.setItem('rememberedEmail', email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }
        
        // Store restaurant data with subscription status
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
 */
/**
 * Create Stripe checkout session
 */
async function createStripeCheckout(planId, restaurantId) {
    try {
        showSuccess(`Creating checkout for ${planId}...`);
        
        // Call your Vercel API
        const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planId: planId,
                restaurantId: restaurantId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create checkout session');
        }
        
        const { url } = await response.json();
        
        // Redirect to Stripe Checkout
        window.location.href = url;
        
    } catch (error) {
        console.error('Checkout error:', error);
        showError('Failed to create checkout. Redirecting to dashboard...');
        
        setTimeout(() => {
            window.location.href = '/dashboard/index.html';
        }, 2000);
    }
}

/**
 * Create URL-safe slug from text
 */
function createSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
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
