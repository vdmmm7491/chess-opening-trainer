import { loadGames, openingStats, findDeviations, groupDeviations, engineCheck, moveLabel, CHECK_PLIES, getReview, saveReview, reviewHref, mistakesOf } from '../chesscom.js';
import { getSettings, setSetting } from '../progress.js';
import { getEngine } from '../engine.js';
import { h, esc } from '../ui.js';
import { CLASSES, POSITIVE, badgeHtml, legendHtml } from '../classify.js';

const LOSS_SHOWN = 30; // don't print a loss for best/book moves
let cache = null; // { user, months, games } kept while the tab is open
let shownGames = 5; // how many recent games are expanded (kept while the tab is open)
const FIRST_GAMES = 5, MORE_GAMES = 10;

export function render(root) {
  let alive = true;
  const view = h(`<section>
    <h1>Game review</h1>
    <p class="muted">Enter your Chess.com username. Your public games are downloaded straight from Chess.com's
      public API (no password needed) and compared with the trainer's repertoire and Stockfish.
      This site is not affiliated with Chess.com.</p>
    <div class="card">
      <div class="form-row">
        <input class="input user" placeholder="Chess.com username" autocapitalize="off" autocomplete="off" spellcheck="false" style="flex:1;min-width:160px" />
        <select class="input months" aria-label="Period">
          <option value="1">Last month</option>
          <option value="3" selected>Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
        </select>
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
    </div>
    <div class="results"></div>
  </section>`);
  root.appendChild(view);
  const $ = (s) => view.querySelector(s);
  const userEl = $('.user');
  userEl.value = getSettings().chesscomUser || '';

  let refreshRecent = null;
  const pb = $('.progressbar'), pbFill = pb.querySelector('span'), msg = $('.msg'), results = $('.results');
  const setProgress = (p) => { pb.hidden = p === null; pbFill.style.width = `${Math.round((p || 0) * 100)}%`; };

  async function load() {
    const user = userEl.value.trim();
    if (!user) { msg.textContent = 'Enter a username first.'; return; }
    setSetting('chesscomUser', user);
    const months = Number($('.months').value);
    msg.textContent = 'Downloading games…';
    results.innerHTML = '';
    setProgress(0);
    try {
      if (!cache || cache.user !== user.toLowerCase() || cache.months !== months) {
        cache = { user: user.toLowerCase(), months, games: await loadGames(user, months, setProgress) };
        shownGames = FIRST_GAMES;
      }
      if (!alive) return;
      setProgress(null);
      show();
    } catch (e) {
      setProgress(null);
      msg.textContent = '⚠ ' + e.message;
    }
  }

  function show() {
    const tc = $('.tc').value;
    const games = cache.games.filter((g) => !tc || g.timeClass === tc);
    msg.textContent = `${games.length} games loaded.`;
    results.innerHTML = '';
    if (!games.length) return;

    const W = games.filter((g) => g.result === 'W').length, D = games.filter((g) => g.result === 'D').length, L = games.length - W - D;
    results.appendChild(h(`<div class="stats" style="margin-top:12px">
      <div class="card stat"><div class="n">${games.length}</div><div class="l">games</div></div>
      <div class="card stat"><div class="n good">${W}</div><div class="l">wins</div></div>
      <div class="card stat"><div class="n">${D}</div><div class="l">draws</div></div>
      <div class="card stat"><div class="n bad">${L}</div><div class="l">losses</div></div>
    </div>`));

    results.appendChild(h(`<div class="card" style="margin-top:12px">
      <b>What to learn next</b> and <b>how your results changed since you started training</b> are on the
      <a href="#/progress">Progress</a> page.</div>`));

    const devs = findDeviations(games);
    results.appendChild(recentGames(games, devs));

    // ---- Repertoire deviations
    const groups = groupDeviations(devs);
    const devRows = groups.slice(0, 25).map((d) => {
      const ex = d.expected.map(esc).join(' / ');
      return `<tr>
        <td>${esc(d.opening.name)}<div class="muted" style="font-size:.8rem">${esc(d.line.name)}</div></td>
        <td><span class="bad">${esc(moveLabel(d.ply, d.played))}</span><div class="muted" style="font-size:.8rem">book: ${ex}</div></td>
        <td>${d.count}×</td>
        <td><a class="btn small" href="#/train/${d.opening.id}?mode=practice&line=${d.lineIdx}">Drill</a></td></tr>`;
    }).join('');
    results.appendChild(h(`<div class="card" style="margin-top:12px">
      <h2 style="margin-top:0">Where you left your repertoire</h2>
      <p class="muted" style="margin-top:0">The first move in each game where you played something different from the trainer's book line (while your opponent was still following it).</p>
      ${devRows ? `<div class="table-wrap"><table><thead><tr><th>Opening</th><th>You played</th><th>Games</th><th></th></tr></thead><tbody>${devRows}</tbody></table></div>`
        : '<p class="muted">No deviations found – either you know your lines, or your games use openings not in the trainer yet.</p>'}
    </div>`));

    // ---- Opening stats
    for (const color of ['w', 'b']) {
      const stats = openingStats(games.filter((g) => g.color === color)).slice(0, 12);
      if (!stats.length) continue;
      const rows = stats.map((s) => {
        const pct = (x) => (x / s.n) * 100;
        const score = Math.round(((s.W + s.D / 2) / s.n) * 100);
        return `<tr><td>${esc(s.family)}</td><td>${s.n}</td>
          <td><div class="wdl"><span class="w" style="width:${pct(s.W)}%"></span><span class="d" style="width:${pct(s.D)}%"></span><span class="l" style="width:${pct(s.L)}%"></span></div>
          <span class="muted" style="font-size:.8rem">${s.W}/${s.D}/${s.L}</span></td>
          <td class="${score >= 55 ? 'good' : score < 45 ? 'bad' : ''}">${score}%</td></tr>`;
      }).join('');
      results.appendChild(h(`<div class="card" style="margin-top:12px">
        <h2 style="margin-top:0">Your openings as ${color === 'w' ? 'White' : 'Black'}</h2>
        <div class="table-wrap"><table><thead><tr><th>Opening</th><th>Games</th><th>W/D/L</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`));
    }

    // ---- Engine check
    const ec = h(`<div class="card" style="margin-top:12px">
      <h2 style="margin-top:0">Stockfish opening check</h2>
      <p class="muted" style="margin-top:0">Runs Stockfish over the first ${CHECK_PLIES / 2} moves of your most recent games and rates each of your moves.
        To rate a whole game, both sides, click it in Recent games.</p>
      ${legendHtml()}
      <div class="form-row">
        <select class="input n"><option value="5">Last 5 games</option><option value="10" selected>Last 10 games</option><option value="20">Last 20 games</option></select>
        <button class="btn primary run">Run engine check</button>
      </div>
      <div class="progressbar" hidden><span></span></div>
      <div class="ec-out" style="margin-top:10px"></div>
    </div>`);
    results.appendChild(ec);
    ec.querySelector('.run').addEventListener('click', () => runEngine(games, ec));
  }

  /** Badge + count for each class that occurs in a game's engineCheck() output. */
  const classCounts = (moves) => Object.keys(CLASSES).map((k) => {
    const n = moves.filter((m) => m.mine !== false && m.kind === k).length;
    return n ? `<span>${badgeHtml(k, 'lg')}${n}</span>` : '';
  }).join('');

  // ---- Recent games: a few at first, "Show more games" expands the list
  function recentGames(games, devs) {
    const devBy = new Map(devs.map((d) => [d.game, d]));
    const card = h(`<div class="card" style="margin-top:12px">
      <h2 style="margin-top:0">Recent games</h2>
      <p class="muted" style="margin-top:0">Click a game to open it on the analysis board: Stockfish rates every move of the game and explains your worst one.</p>
      ${legendHtml()}
      <div class="table-wrap"><table class="recent"><thead><tr><th>Game</th><th>Opening</th><th>Your mistake</th><th></th></tr></thead><tbody></tbody></table></div>
      <button class="btn more" style="margin-top:10px;width:100%">▾ Show More Games</button>
    </div>`);
    const tbody = card.querySelector('tbody'), more = card.querySelector('.more');
    const row = (g) => {
      const dev = devBy.get(g);
      const errs = getReview(g.url)?.moves;
      let issue;
      if (errs) {
        const bad = mistakesOf(errs), worst = bad[0];
        issue = (worst
          ? `<b>${esc(moveLabel(worst.ply, worst.san))}</b>${badgeHtml(worst.kind)}
             <div class="muted" style="font-size:.8rem">${CLASSES[worst.kind].label} · better: ${esc(worst.best)}${bad.length > 1 ? ` · +${bad.length - 1} more` : ''}</div>`
          : '<span class="good">No mistakes</span>')
          + `<div class="class-counts" style="margin-top:4px">${classCounts(errs)}</div>`;
      } else if (dev) {
        issue = `<span class="bad"><b>${esc(moveLabel(dev.ply, dev.played))}</b></span>
          <div class="muted" style="font-size:.8rem">left the book (${esc(dev.expected.join(' / '))})</div>`;
      } else issue = '<span class="muted">Not checked yet</span>';
      const res = { W: ['good', 'Won'], D: ['', 'Draw'], L: ['bad', 'Lost'] }[g.result];
      const href = reviewHref(g, dev);
      return `<tr class="game-row" data-href="${esc(href)}" tabindex="0" title="Open in analysis">
        <td><b class="${res[0]}">${res[1]}</b> vs ${esc(g.opponent)} <span class="muted">(${g.oppRating})</span>
          <div class="muted" style="font-size:.8rem">${g.color === 'w' ? '⚪ White' : '⚫ Black'} · ${esc(g.timeClass)} · ${new Date(g.end).toLocaleDateString()}</div></td>
        <td>${esc(g.opening)}</td>
        <td>${issue}</td>
        <td><a class="btn small" href="${esc(href)}">Review ›</a></td></tr>`;
    };
    function fill() {
      const n = Math.min(shownGames, games.length);
      tbody.innerHTML = games.slice(0, n).map(row).join('');
      const left = games.length - n;
      more.hidden = left <= 0;
      more.textContent = `▾ Show More Games (${left} more)`;
    }
    more.addEventListener('click', () => { shownGames += MORE_GAMES; fill(); });
    const open = (e) => {
      const tr = e.target.closest('.game-row');
      if (!tr || e.target.closest('a')) return;
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      location.hash = tr.dataset.href;
    };
    tbody.addEventListener('click', open);
    tbody.addEventListener('keydown', open);
    fill();
    refreshRecent = fill;
    return card;
  }

  async function runEngine(games, ec) {
    const n = Number(ec.querySelector('.n').value);
    const sel = games.slice(0, n);
    const btn = ec.querySelector('.run');
    const bar = ec.querySelector('.progressbar'), fill = bar.querySelector('span'), out = ec.querySelector('.ec-out');
    btn.disabled = true; bar.hidden = false; out.innerHTML = '<p class="muted">Analysing… this takes a few seconds per game (longer on phones). Games you already reviewed are instant.</p>';
    const engine = getEngine();
    const found = [];
    try {
      for (let i = 0; i < sel.length; i++) {
        if (!alive) return;
        const g = sel[i];
        const step = (done, total) => { fill.style.width = `${((i + (total ? done / total : 1)) / sel.length) * 100}%`; };
        let moves = getReview(g.url)?.moves;
        if (moves) step(1, 1);
        else {
          moves = await engineCheck(engine, g, { maxPly: CHECK_PLIES, onStep: step });
          saveReview(g.url, moves, false);
        }
        // A full review also has the rest of the game: keep to the same opening window here.
        moves.filter((e) => e.mine !== false && e.ply < CHECK_PLIES).forEach((e) => found.push({ ...e, game: g }));
      }
    } catch (e) {
      if (!alive) return;
      out.innerHTML = `<p class="bad">Engine check stopped: ${esc(e.message)}</p>`;
      btn.disabled = false; return;
    }
    btn.disabled = false; bar.hidden = true;
    refreshRecent?.();
    // Your best finds first, then your biggest losses. Each opens the game review at that move.
    const finds = found.filter((e) => POSITIVE.includes(e.kind));
    const errors = mistakesOf(found);
    const moveRow = (e) => `<tr>
        <td><a href="${esc(e.game.url)}" target="_blank" rel="noopener">vs ${esc(e.game.opponent)}</a>
          <div class="muted" style="font-size:.8rem">${esc(e.game.opening)} · ${new Date(e.game.end).toLocaleDateString()}</div></td>
        <td>${esc(moveLabel(e.ply, e.san))}${badgeHtml(e.kind)}<div class="muted" style="font-size:.8rem">${CLASSES[e.kind].label}</div></td>
        <td>${e.loss >= LOSS_SHOWN ? (e.loss / 100).toFixed(1) : ''}</td>
        <td>${esc(e.best)}</td>
        <td><a class="btn small" href="${esc(reviewHref(e.game))}&ply=${e.ply}">Analyse</a></td>
      </tr>`;
    const table = (rows) => `<div class="table-wrap"><table><thead><tr><th>Game</th><th>Move</th><th>Loss</th><th>Better</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    out.innerHTML = `${finds.length ? `<h3 style="margin-top:0">Your best finds</h3>${table(finds.map(moveRow).join(''))}` : ''}
      <h3${finds.length ? '' : ' style="margin-top:0"'}>Biggest losses</h3>
      ${errors.length ? table(errors.slice(0, 30).map(moveRow).join('')) : '<p class="good">No significant opening mistakes found in these games. 👏</p>'}`;
  }

  $('.load').addEventListener('click', load);
  userEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  $('.tc').addEventListener('change', () => { if (cache) show(); });
  if (cache && cache.user === userEl.value.trim().toLowerCase()) show();
  else if (userEl.value.trim()) load(); // your saved Chess.com account: analyse it straight away

  return () => { alive = false; getEngine().stop(); };
}
