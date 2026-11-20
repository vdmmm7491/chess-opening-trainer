// Famous games: a list, and a replay viewer with key-moment comments.
import { GAMES, getGame } from '../games.js';
import { getOpening } from '../openings.js';
import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { getSettings } from '../progress.js';
import { h, esc, Chess, EvalBar, checkSquare, renderMoveList, makeAnalyser } from '../ui.js';

const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;

export function render(root, { id }) {
  if (id) return viewer(root, id);

  root.appendChild(h(`<section>
    <h1>Famous games</h1>
    <p class="muted">Classic games played in the openings you practise. Step through them move by move. Key moments are explained, and Stockfish\'s evaluation shows who is winning.</p>
  </section>`));
  const grid = h('<div class="grid"></div>');
  for (const g of GAMES) {
    const o = g.openingId ? getOpening(g.openingId) : null;
    grid.appendChild(h(`<article class="card opening-card game-card">
      <div class="title"><h3>${esc(g.title)}</h3><span class="tag">${g.year}</span></div>
      <div class="muted" style="font-size:.9rem">${esc(g.white)} – ${esc(g.black)} · <b>${esc(g.result)}</b></div>
      <div class="lvl-row"><span class="lvl" style="--lvl:var(--accent)">${esc(g.opening)}</span>${g.analysis ? '<span class="lvl" style="--lvl:var(--warn)">analysis line</span>' : ''}</div>
      <p>${esc(g.famous)}</p>
      <div class="btn-row">
        <a class="btn primary small" href="#/games/${g.id}">▶ Replay</a>
        ${o ? `<a class="btn small" href="#/train/${o.id}?mode=learn">Learn the ${esc(o.name)}</a>` : ''}
      </div>
    </article>`));
  }
  root.appendChild(grid);
}

function viewer(root, id) {
  const g = getGame(id);
  if (!g) { root.appendChild(h('<p>Game not found. <a href="#/games">Back</a></p>')); return; }
  const sans = g.moves.trim().split(/\s+/);
  // Pre-compute every position.
  const c = new Chess();
  const fens = [c.fen()], lastMoves = [null], checks = [null];
  for (const s of sans) { const m = c.move(s); fens.push(c.fen()); lastMoves.push({ from: m.from, to: m.to }); checks.push(checkSquare(c)); }
  const o = g.openingId ? getOpening(g.openingId) : null;

  const view = h(`<div class="play-layout">
    <div>
      <div class="board-wrap"><div class="board"></div></div>
      <div class="board-nav">
        <button class="btn" data-act="first" aria-label="First move">⏮</button>
        <button class="btn" data-act="back" aria-label="Previous move">◀</button>
        <button class="btn primary" data-act="play">▶ Play</button>
        <button class="btn" data-act="fwd" aria-label="Next move">▶|</button>
        <button class="btn" data-act="last" aria-label="Last move">⏭</button>
      </div>
    </div>
    <aside class="side">
      <div class="card">
        <a href="#/games" class="muted" style="font-size:.85rem">← All famous games</a>
        <h1 style="margin:6px 0 4px">${esc(g.title)}</h1>
        <div class="muted" style="font-size:.9rem">${esc(g.white)} – ${esc(g.black)}, ${esc(g.event)} ${g.year} · <b>${esc(g.result)}</b></div>
        <div class="lvl-row" style="margin-top:8px"><span class="lvl" style="--lvl:var(--accent)">${esc(g.opening)}</span></div>
      </div>
      <div class="card status-card">
        <div class="movelist"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn small" data-act="flip">⇅ Flip</button>
        </div>
      </div>
      <div class="card coach">
        <div class="coach-head"><span class="coach-avatar">📖</span><b>Story of the game</b></div>
        <div class="coach-body"></div>
      </div>
      <div class="card">
        <p style="margin:0">${esc(g.famous)}</p>
        <div class="engine-line" style="margin-top:8px"></div>
        <p class="muted" style="font-size:.8rem;margin:8px 0 0">Score source: <a href="${esc(g.source)}" target="_blank" rel="noopener">${esc(new URL(g.source).hostname)}</a></p>
        ${o ? `<div class="btn-row" style="margin-top:10px"><a class="btn small" href="#/train/${o.id}?mode=learn">Learn the ${esc(o.name)}</a></div>` : ''}
      </div>
    </aside>
  </div>`);
  root.appendChild(view);
  const $ = (s) => view.querySelector(s);

  const bar = new EvalBar();
  $('.board-wrap').prepend(bar.el);
  const board = new Board($('.board'), { canMove: () => false });
  if (g.black.includes('Nakamura') || g.black.includes('Fischer') || g.black.includes('Kasparov')) board.setOrientation('b');
  bar.setOrientation(board.orientation);
  const analyser = makeAnalyser(getEngine(), bar, $('.engine-line'), null);
  let cursor = 0, timer = null;

  // The latest key moment at or before the current move.
  const momentKeys = Object.keys(g.moments || {}).map(Number).sort((a, b) => a - b);

  function show() {
    board.setFen(fens[cursor], lastMoves[cursor], checks[cursor]);
    const list = $('.movelist');
    renderMoveList(list, sans, (i) => { stop(); cursor = i + 1; show(); }, cursor - 1);
    const cur = list.querySelector('.mv.cur');
    list.scrollTop = cur ? cur.offsetTop - list.offsetTop - list.clientHeight / 2 : 0;
    bar.setVisible(getSettings().evalBar !== false);
    bar.setOrientation(board.orientation);
    analyser.run(fens[cursor], { depth: 14 });
    const ply = cursor - 1;
    const here = g.moments?.[ply];
    const prevKey = [...momentKeys].reverse().find((k) => k < ply);
    const nextKey = momentKeys.find((k) => k > ply);
    let html = '';
    if (cursor === 0) html = `<p>${esc(g.famous)}</p><p class="muted">Press ▶ Play or step through with the arrows. Key moments are explained here.</p>`;
    else if (here) html = `<div class="coach-entry you"><div class="coach-title">${esc(moveNo(ply, sans[ply]))}</div><p class="coach-idea">${esc(here)}</p></div>`;
    else html = `<p class="muted">${esc(moveNo(ply, sans[ply]))}</p>` +
      (prevKey !== undefined ? `<div class="coach-entry"><div class="coach-title">Earlier: ${esc(moveNo(prevKey, sans[prevKey]))}</div><p>${esc(g.moments[prevKey])}</p></div>` : '');
    if (nextKey !== undefined && !here) html += `<p class="muted" style="font-size:.85rem">Next key moment at move ${Math.floor(nextKey / 2) + 1}.</p>`;
    if (cursor === sans.length) html += `<p><b>Result: ${esc(g.result)}</b></p>`;
    $('.coach-body').innerHTML = html;
    $('[data-act="play"]').textContent = timer ? '⏸ Pause' : '▶ Play';
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    if (timer) { stop(); show(); return; }
    if (cursor >= sans.length) cursor = 0;
    timer = setInterval(() => {
      if (!view.isConnected) return stop();
      if (cursor >= sans.length) { stop(); show(); return; }
      cursor++;
      // Pause on key moments so they can be read.
      if (g.moments?.[cursor - 1]) { stop(); }
      show();
    }, 1100);
    show();
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act !== 'play') stop();
    if (act === 'first') cursor = 0;
    if (act === 'back') cursor = Math.max(0, cursor - 1);
    if (act === 'fwd') cursor = Math.min(sans.length, cursor + 1);
    if (act === 'last') cursor = sans.length;
    if (act === 'flip') board.flip();
    if (act === 'play') return play();
    show();
  });
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { stop(); cursor = Math.max(0, cursor - 1); show(); }
    if (e.key === 'ArrowRight') { stop(); cursor = Math.min(sans.length, cursor + 1); show(); }
  };
  window.addEventListener('keydown', onKey);
  show();
  return () => { stop(); analyser.cancel(); window.removeEventListener('keydown', onKey); };
}
