import { OPENINGS, LEVELS, getOpening, linesFor } from '../openings.js';
import { summary, openingProgress, lineProgress, lineStats, activityDays, history, exportJson, importJson, resetAll, today, mastery, getSettings, setSetting, getLevel } from '../progress.js';
import { h, esc, progressBar } from '../ui.js';
import { loadGames } from '../chesscom.js';
import { recommend, levelName, prettyFamily } from '../recommend.js';
import { cloudStatus, pushReplace } from '../cloud.js';
import { cloudPanel } from '../account.js';

export function render(root) {
  let alive = true;
  const s = summary();
  root.appendChild(h(`<section>
    <h1>Your progress</h1>
    <div class="stats">
      <div class="card stat"><div class="n">${s.streak}</div><div class="l">day streak 🔥</div></div>
      <div class="card stat"><div class="n">${s.attempts}</div><div class="l">lines practised</div></div>
      <div class="card stat"><div class="n">${Math.round(s.accuracy * 100)}%</div><div class="l">perfect runs</div></div>
      <div class="card stat"><div class="n">${s.learned}</div><div class="l">lines learned (strength 3+)</div></div>
    </div>
  </section>`));

  root.appendChild(learnNextSection(() => alive));

  // Activity heatmap – last 18 weeks
  const days = activityDays();
  const heat = h('<div class="heat"></div>');
  const d = new Date();
  d.setDate(d.getDate() - 125);
  for (let i = 0; i < 126; i++) {
    d.setDate(d.getDate() + 1);
    const n = days[today(d)] || 0;
    const lvl = n === 0 ? '' : n < 3 ? 'h1' : n < 6 ? 'h2' : n < 10 ? 'h3' : 'h4';
    heat.appendChild(h(`<span class="${lvl}" title="${today(d)}: ${n} lines"></span>`));
  }
  const act = h('<div class="card"><h2 style="margin-top:0">Activity</h2></div>');
  act.appendChild(heat);
  root.appendChild(act);

  // Per-opening table: only the openings you've started (completed at least one line in Practice)
  const started = OPENINGS.map((o) => ({ o, p: openingProgress(o) })).filter(({ p }) => p.value > 0);
  const rows = started.map(({ o, p }) => {
    const lines = linesFor(o, getLevel()).map(({ idx: i, name }) => {
      const st = lineStats(o.id, i);
      const lp = Math.round(lineProgress(o.id, i) * 100);
      const due = st && st.due > Date.now() ? `review in ${Math.ceil((st.due - Date.now()) / 86400000)}d` : '<span class="warn">due</span>';
      return `<div class="kv"><a href="#/train/${o.id}?mode=practice&line=${i}">${esc(name)}</a>
        <span class="muted">${st ? `${lp}% · strength ${st.box}/5 · ${st.perfect}/${st.attempts} perfect · ${due}` : lp ? `${lp}% · from a lower level` : 'not started'}</span></div>`;
    }).join('');
    return `<tr><td><b>${esc(o.name)}</b> <span class="tag ${o.side}">${o.side === 'w' ? 'W' : 'B'}</span>
      <div style="margin-top:6px">${progressBar(p)}</div>
      <details style="margin-top:6px"><summary class="muted">Lines</summary>${lines}</details></td>
      <td style="width:70px">${Math.round(p.value * 100)}%</td></tr>`;
  }).join('');
  const table = h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Your openings <span class="muted" style="font-size:.85rem;font-weight:400">· ${esc(LEVELS[getLevel()].name)} level</span></h2>
    ${started.length
      ? `<p class="muted" style="margin-top:0">${started.length} of ${OPENINGS.length} openings started.</p>
        <div class="table-wrap"><table><thead><tr><th>Opening</th><th>Mastery</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="muted">You haven\'t started an opening yet. Finish a line in Practice and it shows up here. <a href="#/">Pick an opening →</a></p>'}</div>`);
  root.appendChild(table);

  // Recent history
  const hist = history().slice(0, 15).map((e) => {
    const o = getOpening(e.id);
    if (!o) return '';
    return `<tr><td>${new Date(e.t).toLocaleString()}</td><td>${esc(o.name)} – ${esc(o.lines[e.line]?.name || '')}${LEVELS[e.level] ? ` <span class="muted">· ${esc(LEVELS[e.level].name)}</span>` : ''}</td>
      <td class="${e.mistakes ? 'bad' : 'good'}">${e.mistakes ? e.mistakes + ' mistake' + (e.mistakes > 1 ? 's' : '') : 'perfect'}</td></tr>`;
  }).join('');
  root.appendChild(h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Recent sessions</h2>
    ${hist ? `<div class="table-wrap"><table><tbody>${hist}</tbody></table></div>` : '<p class="muted">No sessions yet – go practise an opening!</p>'}</div>`));

  // Cloud sync (optional sign-in)
  const cloudCard = h(`<div class="card cloud-card" id="sync" style="margin-top:12px"><h2 style="margin-top:0">Sync between devices</h2></div>`);
  root.appendChild(cloudCard);
  const offCloud = cloudPanel(cloudCard);

  // Backup / sync between devices
  const backup = h(`<div class="card backup-card" style="margin-top:12px"><h2 style="margin-top:0">Backup &amp; move between devices</h2>
    <p class="muted">Progress is saved in this browser. Export it to a file and import it on another device, or sign in above to sync it automatically.</p>
    <div class="btn-row">
      <button class="btn small" data-act="export">⬇ Export</button>
      <label class="btn small">⬆ Import<input type="file" accept="application/json" hidden></label>
      <button class="btn small" data-act="reset">Reset all progress</button>
    </div></div>`);
  root.appendChild(backup);
  backup.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'export') {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `opening-trainer-progress-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (b.dataset.act === 'reset') {
      const cloud = cloudStatus().email;
      if (!confirm(cloud ? 'Delete all progress on this device AND in your synced copy? This cannot be undone.'
        : 'Delete all progress on this device? This cannot be undone.')) return;
      resetAll();
      pushReplace().finally(() => location.reload());
    }
  });
  backup.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { importJson(await f.text()); await pushReplace(); location.reload(); }
    catch (err) { alert('Import failed: ' + err.message); }
  });
  return () => { alive = false; offCloud(); };
}

// ---- What to learn next: the openings that beat you on Chess.com, and what counters them
const MONTHS = 3;

function learnNextSection(isAlive) {
  const sec = h(`<div class="card learn-next" style="margin-top:12px">
    <h2 style="margin-top:0">What to learn next</h2>
    <p class="muted" style="margin-top:0">Loads your last ${MONTHS} months of Chess.com games, finds the openings you keep losing to and suggests the trainer opening that counters each one.</p>
    <div class="form-row">
      <input class="input user" placeholder="Chess.com username" autocapitalize="off" autocomplete="off" spellcheck="false" style="flex:1;min-width:160px" />
      <select class="input tc" aria-label="Time control">
        <option value="">All time controls</option><option value="bullet">Bullet</option>
        <option value="blitz">Blitz</option><option value="rapid">Rapid</option><option value="daily">Daily</option>
      </select>
      <button class="btn primary load">Find my weak spots</button>
    </div>
    <div class="progressbar" hidden><span></span></div>
    <div class="msg muted" style="margin-top:8px"></div>
    <div class="learn-out"></div>
  </div>`);
  const $ = (q) => sec.querySelector(q);
  const userEl = $('.user'), msg = $('.msg'), pb = $('.progressbar'), pbFill = pb.querySelector('span'), out = $('.learn-out');
  userEl.value = getSettings().chesscomUser || '';
  let games = null;

  async function load() {
    const user = userEl.value.trim();
    if (!user) { msg.textContent = 'Enter your Chess.com username first.'; return; }
    setSetting('chesscomUser', user);
    msg.textContent = 'Downloading games…'; out.innerHTML = '';
    pb.hidden = false; pbFill.style.width = '0%';
    try {
      games = await loadGames(user, MONTHS, (p) => { pbFill.style.width = `${Math.round(p * 100)}%`; });
    } catch (e) {
      if (isAlive()) { pb.hidden = true; msg.textContent = '⚠ ' + e.message; }
      return;
    }
    if (!isAlive()) return;
    pb.hidden = true;
    show();
  }

  function show() {
    const tc = $('.tc').value;
    const gs = games.filter((g) => !tc || g.timeClass === tc);
    msg.textContent = `${gs.length} games from the last ${MONTHS} months. Games come from Chess.com's public API; this site is not affiliated with Chess.com.`;
    out.innerHTML = '';
    if (gs.length) out.appendChild(learnNextList(gs));
  }

  $('.load').addEventListener('click', load);
  userEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  $('.tc').addEventListener('change', () => { if (games) show(); });
  if (userEl.value.trim()) queueMicrotask(load);
  return sec;
}

/** The weak-spot list for a set of parsed games (exported so it can be tested with sample games). */
export function learnNextList(games) {
  const { level, items } = recommend(games, { mastery });
  const wrap = h('<div></div>');
  if (level) wrap.appendChild(h(`<p class="muted" style="margin:0 0 8px">Picked for your level: <b>${esc(levelName(level.level))}</b>, based on your recent games.</p>`));
  if (!items.length) {
    wrap.appendChild(h('<p class="good">No weak spots: there is no opening you\'ve lost to twice or more while scoring under 50%. 👏</p>'));
    return wrap;
  }
  const pct = (x) => Math.round(x * 100);
  wrap.insertAdjacentHTML('beforeend', items.slice(0, 5).map((it) => {
    const side = it.color === 'w' ? '⚪ As White' : '⚫ As Black';
    const picks = it.picks.map((p) => {
      const o = p.opening, m = pct(mastery(o));
      const tag = p.kind === 'drill' ? 'Drill' : p.kind === 'avoid' ? 'Avoid it with' : 'Counter';
      const btn = p.kind === 'drill'
        ? `<a class="btn small primary" href="#/train/${o.id}?mode=practice&line=${p.lineIdx}">Drill this line</a>`
        : `<a class="btn small${picksPrimary(it, p) ? ' primary' : ''}" href="#/train/${o.id}?mode=learn">${m ? `Continue (${m}%)` : 'Start learning'}</a>`;
      return `<li><span class="tag learn-kind ${p.kind}">${tag}</span> <b>${esc(o.name)}</b>${p.kind === 'drill' ? ` <span class="muted">– ${esc(p.line.name)}</span>` : ''}
        ${p.fits === false ? `<span class="muted" style="font-size:.8rem"> · aimed at ${esc((o.levels || []).map(levelName).join(' / '))}</span>` : ''}
        <div class="muted learn-why">${esc(p.why)}</div>
        <div class="learn-actions">${btn}</div></li>`;
    }).join('') || '<li class="muted">The trainer has no opening for this yet.</li>';
    const worst = it.lost[0];
    return `<div class="learn-item">
      <div class="learn-head"><b>${side} vs ${esc(prettyFamily(it.family))}</b>
        <span class="muted">${it.n} games · ${it.W}W ${it.D}D <span class="bad">${it.L}L</span> · <span class="${pct(it.score) < 40 ? 'bad' : ''}">${pct(it.score)}%</span></span></div>
      <ul class="learn-sugg">${picks}</ul>
      ${worst?.url ? `<a class="muted learn-loss" href="${esc(worst.url)}" target="_blank" rel="noopener">See your latest loss on Chess.com (vs ${esc(worst.opponent)}) ↗</a>` : ''}
    </div>`;
  }).join(''));
  return wrap;
}
const picksPrimary = (it, p) => it.picks.find((x) => x.kind !== 'drill') === p && !it.picks.some((x) => x.kind === 'drill');
