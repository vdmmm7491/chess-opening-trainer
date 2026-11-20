// Famous games: a list, and a replay viewer with commentary on every move and Stockfish badges.
import { GAMES, getGame } from '../games.js';
import { getOpening } from '../openings.js';
import { getEngine, formatEval } from '../engine.js';
import { Board } from '../board.js';
import { getSettings } from '../progress.js';
import { h, esc, Chess, EvalBar, checkSquare, makeAnalyser, pvToSan } from '../ui.js';
import { CLASSES, NEGATIVE, badgeHtml } from '../classify.js';
import { explainMove, noteFor } from '../coach.js';
import { annotateGame, savedAnnotation } from '../game-annotate.js';

const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;

export function render(root, { id }) {
  if (id) return viewer(root, id);

  root.appendChild(h(`<section>
    <h1>Famous games</h1>
    <p class="muted">Classic games played in the openings you practise. Step through them move by move. Every move has commentary, Stockfish rates each move with a badge, and the evaluation bar shows who is winning.</p>
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
  const fens = [c.fen()], lastMoves = [null], checks = [null], moveObjs = [];
  for (const s of sans) {
    const m = c.move(s);
    moveObjs.push(m);
    fens.push(c.fen()); lastMoves.push({ from: m.from, to: m.to }); checks.push(checkSquare(c));
  }
  const o = g.openingId ? getOpening(g.openingId) : null;
  const notes = g.notes || {};
  const engine = getEngine();

  const view = h(`<div class="play-layout game-view">
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
      <div class="card gc-head">
        <a href="#/games" class="muted" style="font-size:.85rem">← All famous games</a>
        <h1 style="margin:6px 0 4px">${esc(g.title)}</h1>
        <div class="muted" style="font-size:.9rem">${esc(g.white)} – ${esc(g.black)}, ${esc(g.event)} ${g.year} · <b>${esc(g.result)}</b></div>
        <div class="lvl-row" style="margin-top:8px"><span class="lvl" style="--lvl:var(--accent)">${esc(g.opening)}</span></div>
      </div>
      <div class="card coach gc-comment">
        <div class="coach-head"><span class="coach-avatar">🎙️</span><b>Commentary</b></div>
        <div class="gc-body"></div>
      </div>
      <div class="card gc-moves">
        <div class="gc-progress"></div>
        <div class="gmoves" role="list"></div>
        <div class="engine-line" style="margin-top:8px"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn small" data-act="flip">⇅ Flip</button>
        </div>
      </div>
      <div class="card gc-report"></div>
      <div class="card">
        <p style="margin:0">${esc(g.famous)}</p>
        <p class="muted" style="font-size:.8rem;margin:8px 0 0">Score source: <a href="${esc(g.source)}" target="_blank" rel="noopener">${esc(new URL(g.source).hostname)}</a>.
          The commentary is written for this site from the game's published annotations; the badges and evaluations come from Stockfish running in your browser.</p>
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
  const analyser = makeAnalyser(engine, bar, $('.engine-line'), null);
  let cursor = 0, timer = null, alive = true, preview = false;

  // ---------- engine annotation ----------
  const rec = savedAnnotation(g.id, sans);
  let annotating = !rec.done;
  const annOf = (ply) => rec.moves[ply] || null;

  // ---------- move list ----------
  const list = $('.gmoves');
  for (let i = 0; i < sans.length; i += 2) {
    list.appendChild(h(`<span class="n">${i / 2 + 1}.</span>`));
    for (const k of [i, i + 1]) {
      if (k >= sans.length) { list.appendChild(h('<span></span>')); continue; }
      list.appendChild(h(`<span class="gm" data-i="${k}" role="listitem"><span class="san">${esc(sans[k])}</span><span class="b"></span></span>`));
    }
  }
  const cells = [...list.querySelectorAll('.gm')];
  const paintBadge = (ply) => { const a = annOf(ply); cells[ply].querySelector('.b').innerHTML = a?.k ? badgeHtml(a.k) : ''; };
  sans.forEach((_, i) => paintBadge(i));
  list.addEventListener('click', (e) => {
    const m = e.target.closest('.gm');
    if (!m) return;
    stop(); cursor = Number(m.dataset.i) + 1; show();
  });

  // ---------- commentary ----------
  const moveNo = (ply) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${sans[ply]}`;
  const player = (ply) => (ply % 2 === 0 ? g.white : g.black);
  function autoNote(ply) {
    const theory = noteFor(sans.slice(0, ply + 1));
    if (theory) return theory;
    const prev = ply > 0 ? moveObjs[ply - 1] : null;
    return explainMove(fens[ply], sans[ply], { prev }, 2).join(' ');
  }
  function engineVerdict(ply) {
    const a = annOf(ply);
    if (!a) return annotating ? '<p class="muted gc-eng"><span class="spinner"></span> Stockfish hasn\'t reached this move yet…</p>' : '';
    if (!a.k) return '';
    const cls = CLASSES[a.k];
    let txt;
    if (NEGATIVE.includes(a.k)) txt = `Stockfish: this costs about <b>${(a.l / 100).toFixed(1)}</b> pawns. Better was <b>${esc(a.b)}</b>.`;
    else if (a.k === 'solid') txt = `Stockfish: a good move. It slightly preferred <b>${esc(a.b)}</b>.`;
    else if (a.k === 'theory') txt = 'Opening theory: this move is in the trainer\'s repertoire.';
    else if (a.k === 'masterstroke') txt = 'Stockfish agrees: a sound sacrifice, and the best move.';
    else if (a.k === 'only') txt = 'Stockfish: the only good move here. Everything else is clearly worse.';
    else txt = a.b === sans[ply] ? 'Stockfish\'s first choice.' : `As good as Stockfish\'s choice, ${esc(a.b)}.`;
    const btn = a.b && a.b !== sans[ply] && a.k !== 'theory' ? ` <button class="btn small" data-act="better">Show ${esc(a.b)}</button>` : '';
    return `<p class="gc-eng">${badgeHtml(a.k)} <b>${cls.label}.</b> ${txt}${btn}</p>`;
  }
  function commentary() {
    if (cursor === 0) {
      return `<p>${esc(g.famous)}</p>
        <p class="muted">Press ▶ Play or step through with the arrows (← → on a keyboard). Every move gets a comment here, and Stockfish rates each move with a badge.</p>`;
    }
    const ply = cursor - 1;
    const note = notes[ply];
    const a = annOf(ply);
    const title = `<div class="gc-title">${a?.k ? badgeHtml(a.k, 'lg') : ''}<b>${esc(moveNo(ply))}</b><span class="muted"> · ${esc(player(ply))}</span></div>`;
    const body = note ? `<p class="gc-note">${esc(note)}</p>` : `<p class="gc-auto">${esc(autoNote(ply))}</p>`;
    let end = '';
    if (cursor === sans.length) {
      end = `<p class="gc-result"><b>${esc(g.result)}</b> · ${esc(resultWords())}</p>`;
    }
    return title + body + engineVerdict(ply) + end;
  }
  function resultWords() {
    const fc = new Chess(fens.at(-1));
    if (fc.isCheckmate()) return 'checkmate.';
    if (g.result === '1-0') return `${g.black.replace(/ \(.*\)$/, '')} resigned.`;
    if (g.result === '0-1') return `${g.white.replace(/ \(.*\)$/, '')} resigned.`;
    return 'a draw.';
  }

  // ---------- report ----------
  const REPORT = ['masterstroke', 'only', 'top', 'solid', 'theory', 'dubious', 'mistake', 'blunder'];
  function report() {
    const done = rec.moves.filter(Boolean).length;
    const prog = $('.gc-progress');
    prog.innerHTML = annotating
      ? `<p class="muted" style="margin:0 0 6px;font-size:.85rem"><span class="spinner"></span> Stockfish is rating the moves: ${done} / ${sans.length}</p>
         <div class="progressbar" style="margin-bottom:10px"><span style="width:${(done / sans.length) * 100}%"></span></div>`
      : '';
    const count = (side) => {
      const n = {};
      rec.moves.forEach((a, i) => { if (a?.k && i % 2 === side) n[a.k] = (n[a.k] || 0) + 1; });
      return n;
    };
    const w = count(0), b = count(1);
    const rows = REPORT.filter((k) => w[k] || b[k]).map((k) =>
      `<tr><td>${w[k] || '–'}</td><td class="gr-c">${badgeHtml(k)} ${CLASSES[k].label}</td><td>${b[k] || '–'}</td></tr>`).join('');
    $('.gc-report').innerHTML = `<h2 style="margin:0 0 6px;font-size:1.05rem">Game report${annotating ? ' <span class="muted" style="font-weight:400;font-size:.8rem">(in progress)</span>' : ''}</h2>
      ${rows ? `<table class="greport"><thead><tr><th>${esc(g.white)}</th><th></th><th>${esc(g.black)}</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="muted" style="margin:0">Stockfish is starting…</p>'}`;
  }

  // ---------- evaluation shown for the current position ----------
  function showEval() {
    const fc = new Chess(fens[cursor]);
    const saved = cursor < sans.length ? annOf(cursor) : rec.final;
    if (fc.isGameOver()) {
      // Decided without the engine, so a running annotation isn't interrupted.
      const mate = fc.isCheckmate();
      bar.set(mate ? { mate: 0, whiteCp: fc.turn() === 'w' ? -10000 : 10000 } : { cp: 0, whiteCp: 0 });
      $('.engine-line').textContent = mate ? 'Checkmate' : 'Draw';
      return;
    }
    if (saved?.e) {
      bar.set(saved.e);
      $('.engine-line').textContent = `${formatEval(saved.e)}  d${saved.e.depth}  ${pvToSan(fens[cursor], saved.pv || [], 6)}`;
      return;
    }
    if (annotating) { bar.set(null); $('.engine-line').textContent = 'Evaluation coming as soon as Stockfish reaches this position…'; return; }
    analyser.run(fens[cursor], { depth: 14 });
  }

  function show() {
    preview = false;
    board.setArrows([]);
    board.setFen(fens[cursor], lastMoves[cursor], checks[cursor]);
    const a = cursor > 0 ? annOf(cursor - 1) : null;
    board.setBadge(a?.k ? lastMoves[cursor].to : null, a?.k ? badgeHtml(a.k) : null);
    cells.forEach((el, i) => el.classList.toggle('cur', i === cursor - 1));
    const cur = cells[cursor - 1];
    list.scrollTop = cur ? cur.offsetTop - list.clientHeight / 2 + cur.offsetHeight / 2 : 0;
    bar.setVisible(getSettings().evalBar !== false);
    bar.setOrientation(board.orientation);
    showEval();
    $('.gc-body').innerHTML = commentary();
    $('[data-act="play"]').textContent = timer ? '⏸ Pause' : '▶ Play';
  }

  function showBetter() {
    const ply = cursor - 1, a = annOf(ply);
    if (!a?.b) return;
    let m;
    try { m = new Chess(fens[ply]).move(a.b); } catch { return; }
    preview = true;
    board.setFen(fens[ply], lastMoves[ply], checks[ply]);
    board.setBadge(null);
    board.setArrows([{ from: m.from, to: m.to, color: 'green' }]);
  }

  // ---------- autoplay: longer pauses on moves with longer comments ----------
  function stop() { if (timer) { clearTimeout(timer); timer = null; } }
  const delay = (ply) => {
    const len = (notes[ply] || '').length;
    return len ? Math.min(9000, 1600 + len * 40) : 1300;
  };
  function step() {
    if (!alive || !view.isConnected) return stop();
    if (cursor >= sans.length) { stop(); show(); return; }
    cursor++;
    show();
    timer = setTimeout(step, delay(cursor - 1));
  }
  function play() {
    if (timer) { stop(); show(); return; }
    if (cursor >= sans.length) cursor = 0;
    timer = setTimeout(step, 400);
    show();
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'better') { stop(); if (preview) show(); else showBetter(); return; }
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

  report();
  show();
  if (annotating) {
    analyser.cancel();
    annotateGame(engine, g.id, sans, rec, {
      onMove: (ply) => {
        if (!alive) return;
        paintBadge(ply);
        report();
        // Refresh the panel if the move or position on screen just got its rating/evaluation.
        if (!preview && (ply === cursor - 1 || ply === cursor)) show();
      },
    }).then(() => {
      annotating = false;
      if (alive) { report(); if (!preview) show(); }
    }).catch(() => {
      annotating = false;
      if (alive) { report(); $('.gc-progress').innerHTML = '<p class="muted" style="font-size:.85rem">Stockfish was interrupted. Reopen the game to finish rating the moves.</p>'; }
    });
  }
  return () => { alive = false; stop(); analyser.cancel(); engine.stop(); window.removeEventListener('keydown', onKey); };
}
