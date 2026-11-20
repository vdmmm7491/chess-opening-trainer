import { OPENINGS, getOpening } from '../openings.js';
import { summary, mastery, lineStats, activityDays, history, exportJson, importJson, resetAll, today, startedLearning, getSettings, setSetting } from '../progress.js';
import { h, esc } from '../ui.js';
import { loadGames } from '../chesscom.js';
import { improvement } from '../improvement.js';
import { recommend } from '../recommend.js';
import { learnNextCard } from './learn-next.js';
import { winrateChart } from './winrate-chart.js';

const DAY = 86400000;
const RECENT_DAYS = 90; // "What to learn next" looks at your recent games only

export function render(root) {
  let alive = true, chart = null;
  const s = summary();
  root.appendChild(h(`<section>
    <h1>Your progress</h1>
    <div class="stats">
      <div class="card stat"><div class="n">${s.streak}</div><div class="l">day streak 🔥</div></div>
      <div class="card stat"><div class="n">${s.attempts}</div><div class="l">lines practised</div></div>
      <div class="card stat"><div class="n">${Math.round(s.accuracy * 100)}%</div><div class="l">perfect runs</div></div>
      <div class="card stat"><div class="n">${s.learned}</div><div class="l">lines learned (level 3+)</div></div>
    </div>
  </section>`));

  const gamesSec = gamesSection();
  root.appendChild(gamesSec);

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

  // Per-opening table
  const rows = OPENINGS.map((o) => {
    const m = Math.round(mastery(o) * 100);
    const lines = o.lines.map((l, i) => {
      const st = lineStats(o.id, i);
      const due = st && st.due > Date.now() ? `review in ${Math.ceil((st.due - Date.now()) / 86400000)}d` : '<span class="warn">due</span>';
      return `<div class="kv"><a href="#/train/${o.id}?mode=practice&line=${i}">${esc(l.name)}</a>
        <span class="muted">${st ? `lvl ${st.box}/5 · ${st.perfect}/${st.attempts} perfect · ${due}` : 'not started'}</span></div>`;
    }).join('');
    return `<tr data-id="${o.id}"><td><b>${esc(o.name)}</b> <span class="tag ${o.side}">${o.side === 'w' ? 'W' : 'B'}</span>
      <div class="bar" style="margin-top:6px"><span style="width:${m}%"></span></div>
      <details style="margin-top:6px"><summary class="muted">Lines</summary>${lines}</details></td>
      <td style="width:70px">${m}%</td></tr>`;
  }).join('');
  const table = h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Openings</h2>
    <div class="table-wrap"><table><thead><tr><th>Opening</th><th>Mastery</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
  root.appendChild(table);

  // Recent history
  const hist = history().slice(0, 15).map((e) => {
    const o = getOpening(e.id);
    if (!o) return '';
    return `<tr><td>${new Date(e.t).toLocaleString()}</td><td>${esc(o.name)} – ${esc(o.lines[e.line]?.name || '')}</td>
      <td class="${e.mistakes ? 'bad' : 'good'}">${e.mistakes ? e.mistakes + ' mistake' + (e.mistakes > 1 ? 's' : '') : 'perfect'}</td></tr>`;
  }).join('');
  root.appendChild(h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Recent sessions</h2>
    ${hist ? `<div class="table-wrap"><table><tbody>${hist}</tbody></table></div>` : '<p class="muted">No sessions yet – go practise an opening!</p>'}</div>`));

  // Backup / sync between devices
  const backup = h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Backup &amp; move between devices</h2>
    <p class="muted">Progress is saved in this browser. Export it to a file and import it on your phone/computer to sync.</p>
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
    if (b.dataset.act === 'reset' && confirm('Delete all progress on this device? This cannot be undone.')) {
      resetAll(); location.reload();
    }
  });
  backup.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { importJson(await f.text()); location.reload(); }
    catch (err) { alert('Import failed: ' + err.message); }
  });

  // ---- Your Chess.com games: win rate since you started training + what to learn next
  function gamesSection() {
    const started = startedLearning();
    const sec = h(`<div>
      <div class="card" style="margin-top:12px">
        <h2 style="margin-top:0">Since you started training</h2>
        <p class="muted" style="margin-top:0">${started
          ? `Your Chess.com results before and after your first session here (${esc(new Date(started).toLocaleDateString())}).`
          : 'Practise an opening and come back: this compares your Chess.com results before and after you started training here.'}
          Games are downloaded from Chess.com's public API. This site is not affiliated with Chess.com.</p>
        <div class="form-row">
          <input class="input user" placeholder="Chess.com username" autocapitalize="off" autocomplete="off" spellcheck="false" style="flex:1;min-width:160px" />
          <select class="input tc" aria-label="Time control">
            <option value="">All time controls</option>
            <option value="bullet">Bullet</option>
            <option value="blitz">Blitz</option>
            <option value="rapid">Rapid</option>
            <option value="daily">Daily</option>
          </select>
          <button class="btn primary load">Load games</button>
        </div>
        <div class="progressbar" hidden><span></span></div>
        <div class="msg muted" style="margin-top:8px"></div>
        <div class="wr-out"></div>
      </div>
      <div class="learn-out"></div>
    </div>`);
    const $ = (q) => sec.querySelector(q);
    const userEl = $('.user'), msg = $('.msg'), pb = $('.progressbar'), pbFill = pb.querySelector('span');
    userEl.value = getSettings().chesscomUser || '';
    let games = null;

    // From 3 months before your first session (so there's a "before") up to today, at most 2 years.
    const months = started ? Math.min(24, Math.max(3, Math.ceil((Date.now() - started) / (30 * DAY)) + 3)) : 3;

    async function load() {
      const user = userEl.value.trim();
      if (!user) { msg.textContent = 'Enter your Chess.com username first.'; return; }
      setSetting('chesscomUser', user);
      msg.textContent = 'Downloading games…';
      pb.hidden = false; pbFill.style.width = '0%';
      try {
        games = await loadGames(user, months, (p) => { pbFill.style.width = `${Math.round(p * 100)}%`; });
      } catch (e) {
        if (alive) { pb.hidden = true; msg.textContent = '⚠ ' + e.message; }
        return;
      }
      if (!alive) return;
      pb.hidden = true;
      show();
    }

    function show() {
      const tc = $('.tc').value;
      const gs = games.filter((g) => !tc || g.timeClass === tc);
      chart?.destroy(); chart = null;
      const out = $('.wr-out'), learn = $('.learn-out');
      out.innerHTML = ''; learn.innerHTML = '';
      table.querySelectorAll('.tag.suggest').forEach((t) => t.remove());
      msg.textContent = `${gs.length} games from the last ${months} months.`;
      if (!gs.length) return;

      const d = improvement(gs, started);
      const sc = (x) => x.n ? `${Math.round(x.score * 100)}%` : '–';
      const diff = d.before.n && d.after.n ? Math.round((d.after.score - d.before.score) * 100) : null;
      const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
      const r = d.rating;
      out.appendChild(h(`<div class="stats" style="margin-top:12px">
        <div class="card stat"><div class="n">${sc(d.before)}</div><div class="l">score before training · ${d.before.n} games</div></div>
        <div class="card stat"><div class="n">${sc(d.after)}</div><div class="l">score since you started · ${d.after.n} games</div></div>
        <div class="card stat"><div class="n ${diff > 0 ? 'good' : diff < 0 ? 'bad' : ''}">${diff === null ? '–' : `${signed(diff)} pts`}</div><div class="l">change in score</div></div>
        ${r ? `<div class="card stat"><div class="n ${r.to > r.from ? 'good' : r.to < r.from ? 'bad' : ''}">${signed(r.to - r.from)}</div><div class="l">${esc(r.timeClass)} rating · ${r.from} → ${r.to}</div></div>` : ''}
      </div>`));
      if (started && !d.before.n) {
        out.appendChild(h(`<p class="muted">No games before ${esc(new Date(started).toLocaleDateString())} in this period, so there's nothing to compare with yet.</p>`));
      }
      if (d.beforeTrained.n || d.afterTrained.n) {
        out.appendChild(h(`<p class="muted" style="margin:4px 0 0">In openings you've trained: <b>${sc(d.beforeTrained)}</b> before (${d.beforeTrained.n} games) → <b>${sc(d.afterTrained)}</b> since (${d.afterTrained.n} games).</p>`));
      }
      chart = winrateChart(d, started);
      out.appendChild(chart.el);
      out.appendChild(h(`<p class="muted" style="font-size:.85rem;margin-bottom:0">Score = wins + half the draws. Periods with fewer than 3 games are left out.
        Chess.com pairs you with players near your rating, so as your rating goes up your score drifts back towards 50% – watch the rating change too.</p>`));

      // What to learn next, from your recent games (or all of them if you've played few lately).
      const recentCut = Date.now() - RECENT_DAYS * DAY;
      const recent = gs.filter((g) => g.end >= recentCut);
      const pool = recent.length >= 20 ? recent : gs;
      learn.appendChild(learnNextCard(pool));

      // Mark the suggested openings in the table below.
      const ids = new Set();
      for (const it of recommend(pool, { mastery }).items.slice(0, 4)) {
        if (it.fix) ids.add(it.fix.opening.id);
        it.alternatives.forEach((a) => ids.add(a.opening.id));
      }
      for (const id of ids) {
        table.querySelector(`tr[data-id="${id}"] b`)?.insertAdjacentHTML('afterend', ' <span class="tag suggest">Suggested</span>');
      }
    }

    $('.load').addEventListener('click', load);
    userEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    $('.tc').addEventListener('change', () => { if (games) show(); });
    if (userEl.value.trim()) queueMicrotask(load); // after the table below exists

    return sec;
  }

  return () => { alive = false; chart?.destroy(); };
}
