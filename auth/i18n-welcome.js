// i18n-welcome.js - Translations for welcome page

const welcomeTranslations = {
    it: {
        'header.signIn': 'Accedi',
        'header.startFree': 'Inizia Gratis',
        
        'page.title': 'Trasforma i clienti occasionali in clienti abituali.',
        'page.subtitle': 'Inizia ora.',
        
        'billing.monthly': 'Mensile',
        'billing.monthlyDesc': 'Prezzo fisso, timbri illimitati',
        'billing.payPerStamp': 'Paga per Timbro',
        'billing.payPerStampDesc': 'Nessun canone mensile, paghi solo ciò che usi',
        
        'plans.basic': 'Basic',
        'plans.premium': 'Premium',
        'plans.perMonth': '/mese',
        'plans.perStamp': '/timbro',
        'plans.unlimitedIncluded': 'Timbri illimitati inclusi',
        'plans.payOnlyUse': 'Paga solo per ciò che usi',
        'plans.mostPopular': 'Più Popolare',
        'plans.activationFeeBasic': '€29.90 attivazione',
        'plans.activationFeePremium': '€49.90 attivazione',
        'plans.includesTwoMonths': 'Include 2 mesi gratis',
        'plans.getStartedBasic': 'Inizia Ora - €29.90',
        'plans.getStartedPremium': 'Inizia Ora - €49.90',
        
        'features.oneLoyaltyCard': '1 carta fedeltà',
        'features.threeLoyaltyCards': '3 carte fedeltà',
        'features.threePromotions': '3 promozioni attive',
        'features.ninePromotions': '9 promozioni attive',
        'features.twoEvents': '2 eventi attivi',
        'features.sixEvents': '6 eventi attivi',
        'features.twoNotifications': '2 notifiche/mese',
        'features.sixNotifications': '6 notifiche/mese',
        'features.unlimitedStamps': 'Timbri illimitati',
        'features.zeroMonthlyFee': '€0 canone mensile',
        'features.realtimeAnalytics': 'Analisi in tempo reale',
        'features.advancedAnalytics': 'Analisi avanzate',
        'features.prioritySupport': 'Supporto prioritario',
        
        'free.or': 'O',
        'free.startFree': 'inizia gratis',
        'free.explore': 'esplora la dashboard e promuovi le tue offerte gratuitamente',
        
        'modal.signUp': 'Registrati',
        'modal.signIn': 'Accedi',
        
        'form.restaurantName': 'Nome Ristorante',
        'form.restaurantPlaceholder': 'Pizzeria Napoli',
        'form.emailAddress': 'Indirizzo Email',
        'form.emailPlaceholder': 'proprietario@ristorante.it',
        'form.password': 'Password',
        'form.passwordPlaceholder': 'Min. 8 caratteri',
        'form.loginPasswordPlaceholder': 'Inserisci la tua password',
        'form.createAccount': 'Crea Account',
        'form.byCreating': 'Creando un account, accetti i nostri',
        'form.terms': 'Termini',
        'form.and': 'e',
        'form.privacy': 'Privacy Policy',
        'form.rememberMe': 'Ricordami',
        'form.forgotPassword': 'Password dimenticata?'
    },
    en: {
        'header.signIn': 'Sign In',
        'header.startFree': 'Start Free',
        
        'page.title': 'Turn your first-time customers into regulars.',
        'page.subtitle': 'Start now.',
        
        'billing.monthly': 'Monthly',
        'billing.monthlyDesc': 'Fixed price, unlimited stamps',
        'billing.payPerStamp': 'Pay-Per-Stamp',
        'billing.payPerStampDesc': 'No monthly fee, pay as you go',
        
        'plans.basic': 'Basic',
        'plans.premium': 'Premium',
        'plans.perMonth': '/mo',
        'plans.perStamp': '/stamp',
        'plans.unlimitedIncluded': 'Unlimited stamps included',
        'plans.payOnlyUse': 'Pay only for what you use',
        'plans.mostPopular': 'Most Popular',
        'plans.activationFeeBasic': '€29.90 activation',
        'plans.activationFeePremium': '€49.90 activation',
        'plans.includesTwoMonths': 'Includes 2 months free',
        'plans.getStartedBasic': 'Get Started - €29.90',
        'plans.getStartedPremium': 'Get Started - €49.90',
        
        'features.oneLoyaltyCard': '1 loyalty card',
        'features.threeLoyaltyCards': '3 loyalty cards',
        'features.threePromotions': '3 promotions active',
        'features.ninePromotions': '9 promotions active',
        'features.twoEvents': '2 events active',
        'features.sixEvents': '6 events active',
        'features.twoNotifications': '2 notifications/month',
        'features.sixNotifications': '6 notifications/month',
        'features.unlimitedStamps': 'Unlimited stamps',
        'features.zeroMonthlyFee': '€0 monthly fee',
        'features.realtimeAnalytics': 'Real-time analytics',
        'features.advancedAnalytics': 'Advanced analytics',
        'features.prioritySupport': 'Priority support',
        
        'free.or': 'Or',
        'free.startFree': 'start free',
        'free.explore': 'explore the dashboard and promote your offers for free',
        
        'modal.signUp': 'Sign Up',
        'modal.signIn': 'Sign In',
        
        'form.restaurantName': 'Restaurant Name',
        'form.restaurantPlaceholder': 'Pizzeria Napoli',
        'form.emailAddress': 'Email Address',
        'form.emailPlaceholder': 'owner@restaurant.com',
        'form.password': 'Password',
        'form.passwordPlaceholder': 'Min. 8 characters',
        'form.loginPasswordPlaceholder': 'Enter your password',
        'form.createAccount': 'Create Account',
        'form.byCreating': 'By creating an account, you agree to our',
        'form.terms': 'Terms',
        'form.and': 'and',
        'form.privacy': 'Privacy Policy',
        'form.rememberMe': 'Remember me',
        'form.forgotPassword': 'Forgot password?'
    }
};

// Helper function to get translation
function getWelcomeTranslation(key, lang) {
    return welcomeTranslations[lang]?.[key] || welcomeTranslations['it'][key] || key;
}

// Language switching function
function switchLanguage(lang) {
    const buttons = document.querySelectorAll('.lang-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.documentElement.lang = lang;
    localStorage.setItem('preferredLanguage', lang);
    updateWelcomeTranslations(lang);
}

// Update all translations on the page
function updateWelcomeTranslations(lang) {
    // Update text content
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = getWelcomeTranslation(key, lang);
        if (translation) {
            element.textContent = translation;
        }
    });
    
    // Update placeholders
    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translation = getWelcomeTranslation(key, lang);
        if (translation) {
            element.placeholder = translation;
        }
    });
}

// Check for saved language preference on load
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLanguage') || 'it';
    
    // Update button states
    document.querySelectorAll('.lang-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === savedLang.toUpperCase()) {
            btn.classList.add('active');
        }
    });
    
    // Apply translations if not Italian
    if (savedLang !== 'it') {
        updateWelcomeTranslations(savedLang);
    }
});