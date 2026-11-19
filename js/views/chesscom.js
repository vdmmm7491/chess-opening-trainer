import { fetchGames, openingStats, findDeviations, groupDeviations, engineCheck, moveLabel, CHECK_PLIES } from '../chesscom.js';
import { getSettings, setSetting } from '../progress.js';
import { getEngine } from '../engine.js';
import { h, esc } from '../ui.js';

let cache = null; // { user, months, games } kept while the tab is open

export function render(root) {
  let alive = true;
  const view = h(`<section>
    <h1>Chess.com opening review</h1>
    <p class="muted">Enter your Chess.com username. Your public games are downloaded straight from Chess.com's
      public API (no password needed) and compared with the trainer's repertoire and Stockfish.</p>
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
        cache = { user: user.toLowerCase(), months, games: await fetchGames(user, months, setProgress) };
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

    // ---- Repertoire deviations
    const groups = groupDeviations(findDeviations(games));
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
      <p class="muted" style="margin-top:0">Runs Stockfish over moves 4–12 of your most recent games and lists the moves that lost the most (in pawns).</p>
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

  async function runEngine(games, ec) {
    const n = Number(ec.querySelector('.n').value);
    const sel = games.slice(0, n);
    const btn = ec.querySelector('.run');
    const bar = ec.querySelector('.progressbar'), fill = bar.querySelector('span'), out = ec.querySelector('.ec-out');
    btn.disabled = true; bar.hidden = false; out.innerHTML = '<p class="muted">Analysing… this takes roughly 10 seconds per game (longer on phones).</p>';
    const engine = getEngine();
    const total = sel.reduce((a, g) => a + Math.max(0, Math.ceil(Math.min(g.sans.length, CHECK_PLIES) / 2) - 3), 0);
    let done = 0;
    const found = [];
    try {
      for (const g of sel) {
        if (!alive) return;
        const errs = await engineCheck(engine, g, { onStep: () => { done++; fill.style.width = `${(done / total) * 100}%`; } });
        errs.forEach((e) => found.push({ ...e, game: g }));
      }
    } catch (e) {
      if (!alive) return;
      out.innerHTML = `<p class="bad">Engine check stopped: ${esc(e.message)}</p>`;
      btn.disabled = false; return;
    }
    btn.disabled = false; bar.hidden = true;
    found.sort((a, b) => b.loss - a.loss);
    if (!found.length) { out.innerHTML = '<p class="good">No significant opening mistakes found in these games. 👏</p>'; return; }
    out.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Game</th><th>Move</th><th>Loss</th><th>Better</th><th></th></tr></thead><tbody>${
      found.slice(0, 30).map((e) => `<tr>
        <td><a href="${esc(e.game.url)}" target="_blank" rel="noopener">vs ${esc(e.game.opponent)}</a>
          <div class="muted" style="font-size:.8rem">${esc(e.game.opening)} · ${new Date(e.game.end).toLocaleDateString()}</div></td>
        <td class="${e.kind === 'Inaccuracy' ? 'warn' : 'bad'}">${esc(moveLabel(e.ply, e.san))}<div style="font-size:.8rem">${e.kind}</div></td>
        <td>${(e.loss / 100).toFixed(1)}</td>
        <td>${esc(e.best)}</td>
        <td><a class="btn small" href="#/analysis?moves=${encodeURIComponent(e.game.sans.slice(0, e.ply).join(' '))}">Analyse</a></td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  $('.load').addEventListener('click', load);
  userEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  $('.tc').addEventListener('change', () => { if (cache) show(); });
  if (cache && cache.user === userEl.value.trim().toLowerCase()) show();

  return () => { alive = false; getEngine().stop(); };
}
