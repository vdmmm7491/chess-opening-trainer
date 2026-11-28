// Account: the Sign in / avatar button in the top bar, and the sign-in panel it shares with the
// Profile page ("Sync between devices"). The sync itself lives in cloud.js.
import { cloudStatus, sendLink, signInPassword, signUp, resetPassword, setPassword, endRecovery, signOut, sync } from './cloud.js';
import { esc } from './ui.js';

// ---- Cloud sync card: sign in with email + password (or an emailed link), then progress syncs on its own
function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 10 ? 'just now' : s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString();
}

/** Fill `container` with the sign-in form or the signed-in status. Returns a cleanup function. */
export function cloudPanel(container) {
  const body = document.createElement('div');
  body.className = 'cloud-body';
  container.appendChild(body);
  let mode = 'password'; // signed out: 'password' | 'link' | 'forgot'
  let note = '';         // success message under the form
  let pwForm = false;    // signed in: the "Set password" form is open

  const emailInput = (v = '') => `<input class="input" type="email" name="email" required placeholder="you@example.com" autocomplete="email" value="${esc(v)}" style="flex:1;min-width:180px" />`;
  const pwInput = (name, auto, ph) => `<input class="input" type="password" name="${name}" required minlength="6" placeholder="${ph}" autocomplete="${auto}" style="flex:1;min-width:180px" />`;
  const link = (act, text) => `<button type="button" class="btn small" data-act="${act}">${text}</button>`;

  function draw(email = body.querySelector('input[name=email]')?.value || '') {
    const st = cloudStatus();
    const err = st.error ? `<p class="bad" role="alert">${esc(st.error)}</p>` : '';
    const ok = note ? `<p class="good">${note}</p>` : '';
    if (st.email && st.state !== 'signed-out') {
      const line = st.state === 'syncing' || st.state === 'loading' ? 'Syncing…'
        : st.state === 'error' ? 'Sync failed, your progress is still saved on this device.'
        : `Synced ${ago(st.lastSync)}.`;
      const setPw = st.recovery || pwForm;
      body.innerHTML = `<p style="margin-top:0">Signed in as <b>${esc(st.email)}</b>. ${esc(line)}</p>${err}
        ${setPw ? `<p style="margin-bottom:4px">${st.recovery ? '<b>Choose a new password</b> to sign in with from now on.' : 'Set a password to sign in with on your other devices.'}</p>
        <form class="form-row cloud-form" data-form="setpw">
          ${pwInput('password', 'new-password', 'New password (6+ characters)')}
          <button class="btn primary" type="submit">Save password</button>
          ${link('cancelpw', 'Not now')}
        </form>` : ''}
        ${ok}
        <div class="btn-row"><button class="btn small" data-act="sync">↻ Sync now</button>
        ${setPw ? '' : link('openpw', 'Set password')}
        <button class="btn small" data-act="signout">Sign out</button></div>
        <p class="muted" style="margin-bottom:0">Progress uploads a few seconds after each line or quiz. Signing out keeps it on this device.</p>`;
    } else if (st.state === 'loading') {
      body.innerHTML = '<p class="muted" style="margin:0">Signing in…</p>';
    } else {
      const intro = '<p class="muted" style="margin-top:0">Optional: sign in to keep progress in sync on your phone and computer. Progress already on this device is kept and merged.</p>';
      if (mode === 'password') {
        body.innerHTML = `${intro}${err}
          <form class="cloud-form" data-form="password" style="display:grid;gap:8px">
            ${emailInput(email)}
            ${pwInput('password', 'current-password', 'Password')}
            <div class="btn-row" style="margin:0">
              <button class="btn primary" type="submit" data-go="signin">Sign in</button>
              <button class="btn" type="submit" data-go="signup">Create account</button>
            </div>
          </form>${ok}
          <div class="btn-row">${link('forgot', 'Forgot password?')}${link('link', 'Email me a sign-in link instead')}</div>`;
      } else {
        const forgot = mode === 'forgot';
        body.innerHTML = `${intro}
          <p style="margin-bottom:4px">${forgot
            ? 'We\'ll email you a link. Open it (on any device) to sign in and choose a password. This also works if you never had one.'
            : 'We\'ll email you a link that signs you in, no password needed. Open it on any device.'}</p>
          ${err}
          <form class="form-row cloud-form" data-form="${mode}">
            ${emailInput(email)}
            <button class="btn primary" type="submit">${forgot ? 'Email me a reset link' : 'Email me a sign-in link'}</button>
          </form>${ok}
          <div class="btn-row">${link('password', '← Sign in with password')}</div>`;
      }
    }
  }

  const fail = (err, email) => { note = ''; draw(email); body.insertAdjacentHTML('afterbegin', `<p class="bad" role="alert">${esc(err.message)}</p>`); };

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (['password', 'link', 'forgot'].includes(act)) { mode = act; note = ''; draw(); body.querySelector('input')?.focus(); return; }
    if (act === 'openpw') { pwForm = true; note = ''; draw(); body.querySelector('input[name=password]')?.focus(); return; }
    if (act === 'cancelpw') { pwForm = false; endRecovery(); draw(); return; }
    b.disabled = true;
    if (act === 'sync') await sync();
    if (act === 'signout') { note = ''; pwForm = false; mode = 'password'; await signOut().catch(() => {}); }
    draw();
  });

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const kind = form.dataset.form;
    const go = e.submitter?.dataset.go || 'signin';
    const email = form.querySelector('input[name=email]')?.value.trim() || '';
    const password = form.querySelector('input[name=password]')?.value || '';
    form.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    const btn = e.submitter || form.querySelector('button[type=submit]');
    btn.textContent = 'Please wait…';
    try {
      if (kind === 'setpw') {
        await setPassword(password);
        pwForm = false; note = 'Password saved. You can now sign in with it on any device.';
      } else if (kind === 'password' && go === 'signup') {
        const r = await signUp(email, password);
        note = r === 'confirm' ? `Almost done: we sent a confirmation link to <b>${esc(email)}</b>. Open it (any device works), then sign in here with your password.` : '';
      } else if (kind === 'password') {
        await signInPassword(email, password);
        note = '';
      } else if (kind === 'forgot') {
        await resetPassword(email);
        note = `Reset link sent to <b>${esc(email)}</b>. Open it to sign in and choose a password.`;
      } else {
        await sendLink(email);
        note = `Link sent to <b>${esc(email)}</b>. Open it on any device to sign in.`;
      }
      draw(email);
    } catch (err) { fail(err, email); }
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
  (dlg.querySelector('[data-form=setpw] input') || dlg.querySelector('input[type=email]'))?.focus();
}
