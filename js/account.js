// Account: the Sign in / avatar button in the top bar, and the sign-in panel it shares with the
// Profile page ("Sync between devices"). The sync itself lives in cloud.js.
import { cloudStatus, sendLink, signOut, sync } from './cloud.js';
import { esc } from './ui.js';

// ---- Cloud sync card: sign in with an emailed link, then progress syncs on its own
function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 10 ? 'just now' : s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString();
}

/** Fill `container` with the sign-in form or the signed-in status. Returns a cleanup function. */
export function cloudPanel(container) {
  const body = document.createElement('div');
  body.className = 'cloud-body';
  container.appendChild(body);
  let sent = '';

  function draw() {
    const st = cloudStatus();
    const err = st.error ? `<p class="bad" role="alert">${esc(st.error)}</p>` : '';
    if (st.email && st.state !== 'signed-out') {
      const line = st.state === 'syncing' || st.state === 'loading' ? 'Syncing…'
        : st.state === 'error' ? 'Sync failed, your progress is still saved on this device.'
        : `Synced ${ago(st.lastSync)}.`;
      body.innerHTML = `<p style="margin-top:0">Signed in as <b>${esc(st.email)}</b>. ${esc(line)}</p>${err}
        <div class="btn-row"><button class="btn small" data-act="sync">↻ Sync now</button>
        <button class="btn small" data-act="signout">Sign out</button></div>
        <p class="muted" style="margin-bottom:0">Progress uploads a few seconds after each line or quiz. Signing out keeps it on this device.</p>`;
    } else if (st.state === 'loading') {
      body.innerHTML = '<p class="muted" style="margin:0">Signing in…</p>';
    } else {
      body.innerHTML = `<p class="muted" style="margin-top:0">Optional: sign in with your email to keep progress in sync on your phone and computer. We email you a link, no password needed. Progress already on this device is kept and merged.</p>
        ${err}
        <form class="form-row cloud-form">
          <input class="input" type="email" required placeholder="you@example.com" autocomplete="email" style="flex:1;min-width:180px" />
          <button class="btn primary" type="submit">Email me a sign-in link</button>
        </form>
        ${sent ? `<p class="good">Link sent to <b>${esc(sent)}</b>. Open it in this browser to finish signing in.</p>` : ''}`;
    }
  }

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    b.disabled = true;
    if (b.dataset.act === 'sync') await sync();
    if (b.dataset.act === 'signout') { sent = ''; await signOut().catch(() => {}); }
    draw();
  });
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = body.querySelector('input[type=email]');
    const btn = body.querySelector('button[type=submit]');
    const email = input.value.trim();
    btn.disabled = true; btn.textContent = 'Sending…';
    try { await sendLink(email); sent = email; draw(); }
    catch (err) { sent = ''; draw(); body.querySelector('input[type=email]').value = email; body.insertAdjacentHTML('afterbegin', `<p class="bad" role="alert">${esc(err.message)}</p>`); }
  });

  const onStatus = () => draw();
  window.addEventListener('cloud-status', onStatus);
  const tick = setInterval(() => { if (cloudStatus().state === 'synced' && !body.contains(document.activeElement)) draw(); }, 30000);
  draw();
  return () => { window.removeEventListener('cloud-status', onStatus); clearInterval(tick); };
}

// Generic person silhouette (our own drawing), used as the signed-in avatar.
const AVATAR = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <circle cx="16" cy="12.5" r="5.5" fill="currentColor"/>
  <path d="M5.5 27.5c1.4-5.4 5.6-8.5 10.5-8.5s9.1 3.1 10.5 8.5" fill="currentColor"/></svg>`;

/** Put the account button in the top bar and keep it in step with the sign-in state. */
export function initAccountButton(btn) {
  const draw = () => {
    const st = cloudStatus();
    const signedIn = !!st.email && st.state !== 'signed-out';
    btn.classList.toggle('signed-in', signedIn);
    btn.dataset.sync = signedIn ? st.state : '';
    if (signedIn) {
      const note = st.state === 'error' ? 'sync failed' : st.state === 'synced' ? 'synced' : 'syncing';
      btn.innerHTML = `<span class="avatar">${AVATAR}</span><span class="sync-dot"></span>`;
      btn.setAttribute('aria-label', `Account: ${st.email}, ${note}`);
      btn.title = `${st.email} · ${note}`;
    } else {
      btn.textContent = st.state === 'loading' ? 'Signing in…' : 'Sign in';
      btn.setAttribute('aria-label', 'Sign in to sync your progress');
      btn.title = 'Sign in to sync your progress between devices';
    }
  };
  window.addEventListener('cloud-status', draw);
  btn.addEventListener('click', openAccount);
  // Back from a sign-in link: show how it went (signed in, or why not).
  window.addEventListener('cloud-link-done', () => { if (!document.querySelector('dialog.account-dialog')) openAccount(); });
  draw();
}

function openAccount() {
  const dlg = document.createElement('dialog');
  dlg.className = 'settings account-dialog';
  dlg.innerHTML = `<h2>${cloudStatus().email ? 'Your account' : 'Sign in'}</h2><div class="panel"></div>
    <div class="btn-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Close</button></div>`;
  document.body.appendChild(dlg);
  const off = cloudPanel(dlg.querySelector('.panel'));
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  dlg.addEventListener('close', () => { off(); dlg.remove(); });
  dlg.showModal();
  dlg.querySelector('input[type=email]')?.focus();
}
