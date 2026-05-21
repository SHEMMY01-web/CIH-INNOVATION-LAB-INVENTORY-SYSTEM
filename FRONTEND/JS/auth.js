// js/auth.js

// Credentials are loaded from env.js (git-ignored). See env.example.js for setup.
const SUPABASE_URL = window.ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials. Please create FRONTEND/JS/env.js from env.example.js.');
}

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const path = window.location.pathname;
const isLoginPage =
  path === '/' ||
  path.includes('index') ||
  path.includes('enter_otp') ||
  path.includes('forgot_password') ||
  path.includes('login_successful');

// Show a thin loading bar at the top instead of hiding the whole page.
// This is much faster-feeling than visibility:hidden.
const loadingBar = document.createElement('div');
loadingBar.id = 'auth-loading-bar';
loadingBar.style.cssText = `
  position:fixed; top:0; left:0; width:0%; height:3px;
  background: linear-gradient(90deg, #1a73e8, #4fc3f7);
  z-index:9999; transition: width 0.3s ease;
`;
document.body.appendChild(loadingBar);
setTimeout(() => loadingBar.style.width = '70%', 10);

function finishLoading() {
  loadingBar.style.width = '100%';
  setTimeout(() => loadingBar.remove(), 300);
}

sbClient.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION') {
    finishLoading();
    if (session) {
      if (isLoginPage) {
        window.location.replace('/dashboard');
      }
    } else {
      if (!isLoginPage) {
        window.location.replace('/');
      }
    }
  }

  if (event === 'SIGNED_IN' && isLoginPage) {
    window.location.replace('/dashboard');
  }

  if (event === 'SIGNED_OUT' && !isLoginPage) {
    window.location.replace('/');
  }
});

async function signOut() {
  await sbClient.auth.signOut();
}
