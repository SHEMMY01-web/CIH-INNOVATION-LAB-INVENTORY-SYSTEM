// js/auth.js

// Initialize Supabase Client
const SUPABASE_URL = 'https://kkltrgjszsuozlrnjrnb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Handle OTP Login Request
 */
async function requestOTP(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: window.location.origin + '/FRONTEND/HTML/dashboard.html'
    }
  });

  if (error) {
    console.error('Error requesting OTP:', error.message);
    alert('Failed to send OTP. Please try again.');
  } else {
    alert('Check your email for the magic link!');
  }
}

/**
 * Check Active Session
 */
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  // Exclude login pages from redirecting to themselves
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html') || path.includes('enter_otp.html') || path.includes('forgot_password.html');

  if (!session) {
    if (!isLoginPage) {
      window.location.href = 'login.html';
    }
  } else {
    console.log('User is authenticated:', session.user.email);
    if (isLoginPage) {
      window.location.href = 'dashboard.html';
    }
    return session.user;
  }
}

// Automatically check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
