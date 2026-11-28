// Optional cloud sync of progress through Supabase (sign in with email + password, or an emailed link).
// One row per user in the `progress` table: { user_id, data (the whole progress state), updated_at },
// protected by row-level security so each user can only read and write their own row.
// Syncing pulls the saved copy, merges it with this device's (mergeStates in progress.js) and
// uploads the result. supabase-js is only downloaded once someone signs in or has a session.

import { snapshot, replaceState, mergeStates, onSave } from './progress.js';

const SUPABASE_URL = 'https://soiypewtdemhvpslkcfr.supabase.co';
// Publishable key: meant to be public; the row-level security policies do the protecting.
const SUPABASE_KEY = 'sb_publishable_8aVgannE55bv4zk_8iiz_Q_0EnbHhxR';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const AUTH_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const PUSH_DELAY = 3000; // ms after the last save before uploading

let clientP = null;
let user = null;
// recovery: back from a password-reset link, so the panel asks for a new password.
let status = { state: 'signed-out', email: '', lastSync: 0, error: '', recovery: false };
let busy = false;
let again = false;
let timer = null;

// JSON with sorted keys, so two copies with the same content compare equal.
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

function client() {
  clientP ||= import(LIB).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
    // Implicit flow: emailed links (sign-in, confirm, password reset) carry the session in the URL
    // themselves, so they work in any browser, e.g. the mail app's or a phone's. PKCE links only
    // worked in the exact browser that asked for them and failed everywhere else.
    auth: { flowType: 'implicit', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
  }));
  return clientP;
}

function setStatus(patch) {
  status = { ...status, ...patch };
  window.dispatchEvent(new CustomEvent('cloud-status', { detail: status }));
}
export function cloudStatus() { return status; }

const hasStoredSession = () => { try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; } };

function friendly(err) {
  const m = String(err?.message || err || 'Something went wrong');
  if (/code verifier/i.test(m)) return 'That link was made for another browser. Sign in with your password, or ask for a new link.';
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password. If you never set a password (you used emailed links), use “Forgot password?” to set one.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/already registered|already been registered|already exists/i.test(m)) return 'That email already has an account. Sign in, or use “Forgot password?” to set a password.';
  if (/should be different/i.test(m)) return 'That is already your password.';
  if (/password should be|password is too|weak password/i.test(m)) return 'Choose a longer password (at least 6 characters).';
  if (/expired|invalid/i.test(m) && /otp|link|token|code/i.test(m)) return 'That sign-in link has expired or was already used. Ask for a new one.';
  if (/rate limit|too many/i.test(m)) return 'Too many sign-in emails for now. Try again in a little while.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Could not reach the sync server. Check your connection.';
  return m;
}

/**
 * The sign-in link's result in this address, wherever Supabase put it: `?code=` (PKCE), or inside
 * the hash, either after our route (`#/?code=`, when the redirect URL already had a hash) or as
 * the whole hash (`#access_token=…` or `#error=…`), which the router would otherwise read as a page.
 */
function linkParams() {
  const out = new URLSearchParams(location.search);
  const hash = location.hash.replace(/^#/, '');
  const inHash = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : /^[a-z_]+=/.test(hash) ? hash : '';
  for (const [k, v] of new URLSearchParams(inHash)) if (!out.has(k)) out.set(k, v);
  const p = {
    code: out.get('code'),
    access: out.get('access_token'),
    refresh: out.get('refresh_token'),
    type: out.get('type') || '',
    error: out.get('error_description') || out.get('error_code') || (out.has('error') ? out.get('error') : ''),
  };
  return p.code || (p.access && p.refresh) || p.error ? p : null;
}

// Read before anything (the router, the tour) touches the address.
const LINK = linkParams();
/** True when this page load came from an emailed link (sign-in, confirm, password reset). */
export const arrivedFromLink = () => !!LINK;

/** Start sync on page load: finish a sign-in link, or resume a saved session. */
export async function initCloud() {
  const link = LINK;
  if (link) {
    // Drop the sign-in parameters from the address and land on the Profile page.
    history.replaceState(null, '', location.pathname + '#/progress');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  const done = () => { if (link) window.dispatchEvent(new CustomEvent('cloud-link-done')); };
  if (link?.error) { setStatus({ state: 'signed-out', error: friendly(link.error.replace(/\+/g, ' ')) }); done(); return; }
  if (!link && !hasStoredSession()) return;

  setStatus({ state: 'loading', error: '' });
  try {
    const sb = await client();
    if (link?.code) {
      const { error } = await sb.auth.exchangeCodeForSession(link.code);
      if (error) throw error;
    } else if (link) {
      const { error } = await sb.auth.setSession({ access_token: link.access, refresh_token: link.refresh });
      if (error) throw error;
    }
    const { data: { session } } = await sb.auth.getSession();
    watchAuth(sb);
    if (session && link?.type === 'recovery') setStatus({ recovery: true });
    if (session) await signedIn(session.user);
    else setStatus({ state: 'signed-out', error: link ? 'Signing in did not finish. Ask for a new link and open it in this browser.' : '' });
  } catch (err) {
    setStatus({ state: user ? 'error' : 'signed-out', error: friendly(err) });
  }
  done();
}

let watching = false;
function watchAuth(sb) {
  if (watching) return;
  watching = true;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { user = null; setStatus({ state: 'signed-out', email: '', lastSync: 0 }); }
    else if (session?.user && session.user.id !== user?.id) signedIn(session.user);
  });
}

let hooked = false;
async function signedIn(u) {
  user = u;
  setStatus({ state: 'syncing', email: u.email || '', error: '' });
  if (!hooked) {
    hooked = true;
    onSave(schedule);
    document.addEventListener('visibilitychange', () => {
      if (!user) return;
      if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = null; sync(); }
      else if (document.visibilityState === 'visible' && Date.now() - status.lastSync > 60000) sync();
    });
  }
  await sync();
}

function schedule() {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => { timer = null; sync(); }, PUSH_DELAY);
}

/**
 * Pull the saved copy, merge it into this device's progress and upload the result.
 * `replace`: upload this device's progress as it is (after Reset or Import), without merging.
 */
export async function sync({ replace = false } = {}) {
  if (!user) return;
  if (busy) { again = true; return; }
  busy = true;
  setStatus({ state: 'syncing', error: '' });
  try {
    const sb = await client();
    let remote = null;
    if (!replace) {
      const { data: row, error } = await sb.from('progress').select('data').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      remote = row?.data || null;
    }
    // Merge with the state as it is now (it may have changed while the row was downloading).
    const local = snapshot();
    const merged = replace ? local : mergeStates(local, remote);
    const mergedStr = canon(merged);
    if (mergedStr !== canon(local)) {
      replaceState(merged);
      window.dispatchEvent(new CustomEvent('progress-synced'));
    }
    if (replace || !remote || mergedStr !== canon(remote)) {
      const { error } = await sb.from('progress')
        .upsert({ user_id: user.id, data: merged, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    setStatus({ state: 'synced', lastSync: Date.now() });
  } catch (err) {
    setStatus({ state: 'error', error: friendly(err) });
  } finally {
    busy = false;
    if (again) { again = false; sync(); }
  }
}

/** Upload this device's progress over the saved copy (Reset / Import), waiting for it to finish. */
export async function pushReplace() {
  if (!user) return;
  clearTimeout(timer); timer = null;
  while (busy) await new Promise((r) => setTimeout(r, 100));
  await sync({ replace: true });
}

export const isSignedIn = () => !!user;

const home = () => location.origin + location.pathname.replace(/index\.html$/, '');

async function ready() {
  setStatus({ error: '' });
  const sb = await client();
  watchAuth(sb);
  return sb;
}

async function begin(u) {
  if (u && u.id !== user?.id) await signedIn(u);
}

/** Email a sign-in link that comes back to this page. */
export async function sendLink(email) {
  const sb = await ready();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: home() } });
  if (error) throw new Error(friendly(error));
}

/** Sign in with email and password. */
export async function signInPassword(email, password) {
  const sb = await ready();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error));
  await begin(data.user);
}

/**
 * Create an account with a password. Returns 'signed-in', or 'confirm' when Supabase first wants
 * the email confirmed (it sends a link; after that, signing in with the password works anywhere).
 */
export async function signUp(email, password) {
  const sb = await ready();
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: home() } });
  if (error) throw new Error(friendly(error));
  // An existing email comes back as a user with no identities (Supabase hides whether it exists).
  if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) {
    throw new Error(friendly('already registered'));
  }
  if (data.session) { await begin(data.user); return 'signed-in'; }
  return 'confirm';
}

/** Email a link that signs in and asks for a new password (also sets a first one). */
export async function resetPassword(email) {
  const sb = await ready();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: home() });
  if (error) throw new Error(friendly(error));
}

/** Set or change the password of the signed-in account. */
export async function setPassword(password) {
  const sb = await client();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(friendly(error));
  setStatus({ recovery: false, error: '' });
}

export const endRecovery = () => setStatus({ recovery: false });

export async function signOut() {
  clearTimeout(timer); timer = null;
  const sb = await client();
  await sb.auth.signOut({ scope: 'local' });
  user = null;
  setStatus({ state: 'signed-out', email: '', lastSync: 0, error: '', recovery: false });
}
