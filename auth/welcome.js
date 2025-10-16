// welcome.js - Combined authentication and checkout flow

let selectedPlan = null;
let selectedBillingType = 'monthly'; // ADD THIS
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

// ADD THIS FUNCTION
/**
 * Switch billing type toggle
 */
function switchBillingType(type) {
    selectedBillingType = type;
    
    // Update toggle UI
    const toggleOptions = document.querySelectorAll('.toggle-option');
    const indicator = document.querySelector('.toggle-indicator');
    
    toggleOptions.forEach(option => {
        if (option.dataset.billing === type) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    if (type === 'metered') {
        indicator.classList.add('metered');
    } else {
        indicator.classList.remove('metered');
    }
    
    // Update pricing cards
    const monthlyElements = document.querySelectorAll('[data-monthly]');
    const meteredElements = document.querySelectorAll('[data-metered]');
    
    if (type === 'monthly') {
        monthlyElements.forEach(el => el.classList.remove('hidden'));
        meteredElements.forEach(el => el.classList.add('hidden'));
    } else {
        monthlyElements.forEach(el => el.classList.add('hidden'));
        meteredElements.forEach(el => el.classList.remove('hidden'));
    }
}

// ADD THIS FUNCTION
/**
 * Select a plan (called when user clicks Get Started)
 */
function selectPlan(planTier) {
    openAuthModal('signup', planTier, selectedBillingType);
}

/**
 * Open auth modal
 */
function openAuthModal(mode = 'signup', plan = 'free', billingType = 'monthly') { // MODIFIED SIGNATURE
    selectedPlan = plan;
    selectedBillingType = billingType; // ADD THIS
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
        
        // Step 1: Create auth user ONLY
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create account');
        
        // Step 2: Call database function to create restaurant atomically
        const { data: result, error: dbError } = await supabase.rpc(
            'create_restaurant_with_owner',
            {
                p_email: email,
                p_restaurant_name: restaurantName,
                p_subscription_tier: selectedPlan,
                p_billing_type: selectedBillingType 
            }
        );
        
        if (dbError || !result.success) {
            // Cleanup: delete auth user via admin API
            // Since we can't delete from client, inform user
            await supabase.auth.signOut();
            throw new Error(result.error || 'Failed to create restaurant. Please contact support with this email: ' + email);
        }
        
        // Success!
        sessionStorage.setItem('userRole', 'owner');
        sessionStorage.setItem('selectedPlan', selectedPlan);
        sessionStorage.setItem('selectedBillingType', selectedBillingType); // ADD THIS
        
        showSuccess('Account created successfully!');
        
        setTimeout(() => {
            if (needsCheckout && selectedPlan !== 'free') {
                createStripeCheckout(selectedPlan, result.restaurant_id, selectedBillingType); // MODIFIED
            } else {
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
async function createStripeCheckout(planId, restaurantId, billingType) { // MODIFIED SIGNATURE
    try {
        showSuccess(`Creating checkout for ${planId}...`);
        
        // Call your Vercel API
        const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planId: planId,
                restaurantId: restaurantId,
                billingType: billingType // ADD THIS
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
