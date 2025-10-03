// Supabase Configuration
const SUPABASE_URL = 'https://vjwdyyzjacjnlkvoxgcm.supabase.co'; // Replace with your URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqd2R5eXpqYWNqbmxrdm94Z2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTQwNDIsImV4cCI6MjA3MzE5MDA0Mn0.DMMCV14UrQROORgMOxwSevYSxYJGOr38bkGK5rHnkGo'; // Replace with your key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Session management utilities
const SessionManager = {
    // Check if user is logged in
    async checkSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        return session;
    },

    // Get current user
    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        return user;
    },

    // Listen for auth changes
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    // Logout
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = '/auth/login.html';
        }
        return error;
    }
};

// Export for use in other files
window.supabase = supabase;
window.SessionManager = SessionManager;