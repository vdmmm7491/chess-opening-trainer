// Optional cloud sync of progress through Supabase (sign in with an emailed link).
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
let status = { state: 'signed-out', email: '', lastSync: 0, error: '' };
let busy = false;
let again = false;
let timer = null;

// JSON with sorted keys, so two copies with the same content compare equal.
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));

function client() {
  clientP ||= import(LIB).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
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
  if (/code verifier/i.test(m)) return 'Open the sign-in link in the same browser where you asked for it.';
  if (/expired|invalid/i.test(m) && /otp|link|token|code/i.test(m)) return 'That sign-in link has expired or was already used. Ask for a new one.';
  if (/rate limit|too many/i.test(m)) return 'Too many sign-in emails for now. Try again in a little while.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Could not reach the sync server. Check your connection.';
  return m;
}

/** Start sync on page load: finish a sign-in link, or resume a saved session. */
export async function initCloud() {
  const query = new URLSearchParams(location.search);
  const hashErr = /^#error=/.test(location.hash) ? new URLSearchParams(location.hash.slice(1)) : null;
  const code = query.get('code');
  const linkErr = query.get('error_description') || hashErr?.get('error_description');
  if (code || linkErr) {
    // Drop the sign-in parameters from the address and land on the Progress page.
    history.replaceState(null, '', location.pathname + '#/progress');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  if (linkErr) { setStatus({ state: 'signed-out', error: friendly(linkErr) }); return; }
  if (!code && !hasStoredSession()) return;

  setStatus({ state: 'loading', error: '' });
  try {
    const sb = await client();
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }
    const { data: { session } } = await sb.auth.getSession();
    watchAuth(sb);
    if (session) await signedIn(session.user);
    else setStatus({ state: 'signed-out' });
  } catch (err) {
    setStatus({ state: user ? 'error' : 'signed-out', error: friendly(err) });
  }
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

/** Email a sign-in link that comes back to this page. */
export async function sendLink(email) {
  setStatus({ error: '' });
  const sb = await client();
  watchAuth(sb);
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname.replace(/index\.html$/, '') },
  });
  if (error) throw new Error(friendly(error));
}

export async function signOut() {
  clearTimeout(timer); timer = null;
  const sb = await client();
  await sb.auth.signOut({ scope: 'local' });
  user = null;
  setStatus({ state: 'signed-out', email: '', lastSync: 0, error: '' });
}
