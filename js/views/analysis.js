import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { getSettings } from '../progress.js';
import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser, findBook } from '../ui.js';
import { engineCheck, reviewCache, moveLabel, mistakesOf, CHECK_PLIES } from '../chesscom.js';
import { CLASSES, badgeHtml } from '../classify.js';
import { explainMove, noteFor, analyseMistake, materialWords } from '../coach.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function render(root, { query }) {
  const engine = getEngine();
  let startFen = START;
  if (query.fen) { try { new Chess(query.fen); startFen = query.fen; } catch { /* bad fen */ } }
  let sans = [];
  if (query.moves) {
    const c = new Chess(startFen);
    for (const s of query.moves.split(/[\s,]+/).filter(Boolean)) { try { c.move(s); sans.push(c.history().at(-1)); } catch { break; } }
  }
  let cursor = sans.length; // number of moves applied
  let enginePlays = null; // 'w' | 'b' | null
  let thinking = false;
  // Game review (opened from the Review tab): ?review=w|b&moves=…[&url=…&vs=…&ply=N&dev=N&book=SAN,SAN]
  const review = query.review === 'w' || query.review === 'b' ? query.review : null;
  let reviewBusy = false; // the review owns the engine; the live analyser waits
  let reviewToken = 0, animToken = 0, alive = true;
  // Move classifications from the review (ply -> class key). They apply while the moves still match the game.
  let classes = [];
  const gameSans = sans.slice();
  const classOf = (i) => (classes[i] && sans.slice(0, i + 1).every((s, k) => s === gameSans[k]) ? classes[i] : null);

  const view = h(`<div class="play-layout">
    <div>
      <div class="board-wrap"><div class="board"></div></div>
      <div class="board-nav">
        <button class="btn" data-act="first" aria-label="First move">⏮</button>
        <button class="btn" data-act="back" aria-label="Previous move">◀</button>
        <button class="btn" data-act="fwd" aria-label="Next move">▶</button>
        <button class="btn" data-act="last" aria-label="Last move">⏭</button>
      </div>
    </div>
    <aside class="side">
      <div class="card">
        <h1 style="margin:0 0 6px">Analysis board</h1>
        <div class="muted book" style="font-size:.9rem;min-height:1.3em"></div>
      </div>
      ${review ? '<div class="card review"></div>' : ''}
      <div class="card">
        <div class="engine-line"></div>
        <label class="toggle" style="margin-top:8px"><input type="checkbox" class="arrow" checked> Show best move arrow</label>
      </div>
      <div class="card">
        <div class="movelist"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn small" data-act="flip">⇅ Flip</button>
          <button class="btn small" data-act="reset">New</button>
        </div>
      </div>
      <div class="card">
        <div class="kv"><span>Play against Stockfish</span></div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn small" data-ep="">Off</button>
          <button class="btn small" data-ep="b">I'm White</button>
          <button class="btn small" data-ep="w">I'm Black</button>
        </div>
      </div>
      <div class="card">
        <div class="form-row">
          <input class="input fen" style="flex:1;min-width:0" placeholder="Paste a FEN or moves (e4 e5 Nf3…)" />
          <button class="btn small" data-act="load">Load</button>
        </div>
      </div>
    </aside>
  </div>`);
  root.appendChild(view);
  const $ = (s) => view.querySelector(s);

  const bar = new EvalBar();
  $('.board-wrap').prepend(bar.el);
  let chess = new Chess(startFen);
  const board = new Board($('.board'), {
    getDests: destsFn(chess),
    canMove: (color) => !thinking && color === chess.turn() && color !== enginePlays,
    onMove: (from, to, promo) => {
      try { chess.move({ from, to, promotion: promo || 'q' }); } catch { return sync(); }
      sans = sans.slice(0, cursor).concat(chess.history().at(-1));
      cursor = sans.length;
      sync();
      maybeEngine();
    },
  });
  const analyser = makeAnalyser(engine, bar, $('.engine-line'), board);
  if (review) board.setOrientation(review);

  function rebuild() {
    chess = new Chess(startFen);
    for (const s of sans.slice(0, cursor)) chess.move(s);
  }

  function sync() {
    board.getDests = destsFn(chess);
    board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
    const cur = cursor > 0 ? classOf(cursor - 1) : null;
    board.setBadge(cur && lastMoveOf(chess)?.to, cur && badgeHtml(cur));
    renderMoveList($('.movelist'), sans, (i) => { cursor = i + 1; rebuild(); sync(); }, cursor - 1,
      sans.map((_, i) => badgeHtml(classOf(i))));
    bar.setOrientation(board.orientation);
    bar.setVisible(getSettings().evalBar !== false);
    const showArrow = $('.arrow').checked && !enginePlays;
    board.setArrows([]);
    animToken++;
    if (!reviewBusy) analyser.run(chess.fen(), { depth: 18, showArrow });
    const bookEl = $('.book');
    if (startFen === START && cursor > 0) {
      const b = findBook(sans.slice(0, cursor));
      bookEl.innerHTML = b
        ? (b.inBook ? `📖 ${esc(b.opening.name)} – ${esc(b.line.name)}` : `Left book after ${esc(b.opening.name)} – ${esc(b.line.name)}`)
        : 'Not in the trainer\'s repertoire.';
    } else bookEl.textContent = startFen === START ? 'Make a move or load a position.' : 'Custom position';
    view.querySelectorAll('[data-ep]').forEach((b) => b.classList.toggle('primary', b.dataset.ep === (enginePlays || '')));
  }

  async function maybeEngine() {
    if (!enginePlays || chess.turn() !== enginePlays || chess.isGameOver()) return;
    thinking = true;
    const fen = chess.fen();
    const res = await engine.analyse(fen, { movetime: 800 });
    thinking = false;
    if (chess.fen() !== fen || !res.bestmove || !enginePlays) return;
    chess.move({ from: res.bestmove.slice(0, 2), to: res.bestmove.slice(2, 4), promotion: res.bestmove[4] });
    sans = sans.slice(0, cursor).concat(chess.history().at(-1));
    cursor = sans.length;
    sync();
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ep !== undefined) {
      enginePlays = b.dataset.ep || null;
      if (enginePlays) board.setOrientation(enginePlays === 'w' ? 'b' : 'w');
      sync(); maybeEngine();
      return;
    }
    switch (b.dataset.act) {
      case 'first': cursor = 0; break;
      case 'back': cursor = Math.max(0, cursor - 1); break;
      case 'fwd': cursor = Math.min(sans.length, cursor + 1); break;
      case 'last': cursor = sans.length; break;
      case 'flip': board.flip(); break;
      case 'reset': startFen = START; sans = []; cursor = 0; break;
      case 'load': {
        const v = $('.fen').value.trim();
        if (!v) return;
        try {
          new Chess(v); startFen = v; sans = []; cursor = 0;
        } catch {
          const c = new Chess();
          try { for (const s of v.replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)) c.move(s); }
          catch { alert('Could not read that FEN / move list.'); return; }
          startFen = START; sans = c.history(); cursor = sans.length;
        }
        break;
      }
      default: return;
    }
    rebuild(); sync();
  });

  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { cursor = Math.max(0, cursor - 1); rebuild(); sync(); }
    if (e.key === 'ArrowRight') { cursor = Math.min(sans.length, cursor + 1); rebuild(); sync(); }
  };
  window.addEventListener('keydown', onKey);

  // ---------------- Game review ----------------
  const fenAt = (ply) => { const c = new Chess(startFen); for (const s of sans.slice(0, ply)) c.move(s); return c.fen(); };
  const uciToSan = (fen, u) => { try { return new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch { return ''; } };
  let items = []; // moves worth looking at: engine mistakes + the move where you left the book

  async function startReview() {
    const el = $('.review');
    const title = `<h2 style="margin:0 0 6px">Game review${query.vs ? ` vs ${esc(query.vs)}` : ''}</h2>`;
    let errs = query.url ? reviewCache.get(query.url) : null;
    if (!errs) {
      reviewBusy = true;
      analyser.cancel();
      el.innerHTML = `${title}<p class="muted"><span class="spinner"></span> Stockfish is checking your opening moves…</p>
        <div class="progressbar"><span></span></div>`;
      const fill = el.querySelector('.progressbar span');
      const total = Math.max(1, Math.ceil(Math.min(sans.length, CHECK_PLIES) / 2) - 3);
      let done = 0;
      try {
        errs = await engineCheck(engine, { sans: gameSans, color: review }, { onStep: () => { fill.style.width = `${(++done / total) * 100}%`; } });
        if (query.url) reviewCache.set(query.url, errs);
      } catch { errs = null; }
      if (!alive) return;
      reviewBusy = false;
      if (!errs) {
        el.innerHTML = `${title}<p class="bad">The review was interrupted.</p><button class="btn small primary" data-rv="restart">↺ Run it again</button>`;
        sync();
        return;
      }
    }
    classes = [];
    for (const m of errs) classes[m.ply] = m.kind;
    items = mistakesOf(errs).map((e) => ({ ...e, bookSans: e.best ? [e.best] : null }));
    const dev = query.dev !== undefined ? Number(query.dev) : null;
    if (dev !== null && sans[dev] && !items.some((e) => e.ply === dev)) {
      items.push({ ply: dev, san: sans[dev], kind: 'Book', bookSans: (query.book || '').split(',').filter(Boolean) });
    }
    let target = items[0];
    if (query.ply !== undefined) {
      const p = Number(query.ply);
      target = items.find((e) => e.ply === p) || (sans[p] ? { ...errs.find((e) => e.ply === p), ply: p, san: sans[p], kind: 'Move', cls: classes[p] } : target);
    }
    if (!target) {
      el.innerHTML = `${title}<p class="good">No significant mistakes in your first ${CHECK_PLIES / 2} moves. 👏</p>
        <p class="muted" style="margin-bottom:0">Step through the game with ◀ ▶ to look at the rest.</p>`;
      cursor = sans.length; rebuild(); sync();
      return;
    }
    explain(target);
  }

  async function explain(item) {
    const my = ++reviewToken;
    const el = $('.review');
    const ply = item.ply, played = sans[ply];
    const fenBefore = fenAt(ply);
    reviewBusy = true;
    analyser.cancel();
    cursor = ply + 1; rebuild(); sync();
    el.innerHTML = `<p class="muted" style="margin:0"><span class="spinner"></span> Looking at ${esc(moveLabel(ply, played))}…</p>`;

    let res = null, better = item.bookSans?.length ? item.bookSans : null;
    // The engine check already found this was (as good as) the best move: don't second-guess it.
    if (['masterstroke', 'only', 'top'].includes(item.cls || classes[ply])) better = [played];
    try {
      if (!better) {
        const r = await engine.analyse(fenBefore, { depth: 12 });
        if (!r.cancelled && r.bestmove) better = [uciToSan(fenBefore, r.bestmove)];
      }
      if (better && !better.includes(played)) res = await analyseMistake(engine, fenBefore, played, better);
    } catch { res = null; }
    if (!alive || my !== reviewToken) return;
    reviewBusy = false;

    const n = Math.min(items.length, 6);
    const chips = items.length && (items.length > 1 || !items.includes(item))
      ? `<div style="margin-top:10px"><span class="muted" style="font-size:.85rem">Moves to look at:</span>
          <div class="btn-row" style="margin-top:4px">${items.slice(0, n).map((e, i) => `<button class="btn small${e === item ? ' primary' : ''}" data-rv="item" data-i="${i}">${esc(moveLabel(e.ply, e.san))}${badgeHtml(e.kind)}</button>`).join('')}</div></div>`
      : '';
    const link = query.url && /^https:\/\/(www\.)?chess\.com\//.test(query.url)
      ? `<a class="btn small" href="${esc(query.url)}" target="_blank" rel="noopener">Open on Chess.com ↗</a>` : '';
    const title = `<h2 style="margin:0 0 6px">Game review${query.vs ? ` vs ${esc(query.vs)}` : ''}</h2>`;

    if (!res) {
      const cls = item.cls || classes[ply], c = CLASSES[cls];
      const what = c ? ` ${badgeHtml(cls)} <b>${c.label}:</b> ${esc(c.desc)}` : '';
      el.innerHTML = `${title}<p>${better?.includes(played)
        ? `<b>${esc(moveLabel(ply, played))}</b> is the engine's choice here.${what || ' Nothing wrong with it.'}`
        : c ? `<b>${esc(moveLabel(ply, played))}</b>${what}`
        : `Couldn't analyse ${esc(moveLabel(ply, played))}.`}</p>${chips}<div class="btn-row" style="margin-top:10px">${link}</div>`;
      sync();
      return;
    }

    const prefix = sans.slice(0, ply);
    const best = better[0];
    const bestWhy = noteFor([...prefix, best]) ? [noteFor([...prefix, best])] : explainMove(fenBefore, best, {}, 2);
    // Moves the engine check rated (dubious / mistake / blunder) keep that label and loss here.
    const ours = CLASSES[item.kind];
    const playable = res.kind === 'Playable' && !ours;
    const kind = playable ? (item.kind === 'Book' ? 'Not the book move' : 'Playable') : res.kind;
    const loss = ours && item.loss ? item.loss : res.loss;
    const reply = res.steps[0];
    let verdict;
    if (playable) {
      verdict = item.kind === 'Book'
        ? `<p><b>${esc(played)}</b> is a reasonable move, but it isn't part of your repertoire. The trainer's line continues <b>${esc(best)}</b>.</p>`
        : `<p><b>${esc(played)}</b> is fine: it costs less than a pawn compared with <b>${esc(best)}</b>.</p>`;
    } else {
      const word = ours ? ours.label.toLowerCase() + (item.kind === 'dubious' ? ' move' : '') : res.kind.toLowerCase();
      verdict = `<p><b>${esc(played)}</b> is ${/^[aeiou]/.test(word) ? 'an' : 'a'} <b>${word}</b>, costing about <b>${(loss / 100).toFixed(1)}</b> pawns.` +
        (res.mateAgainst ? ' It even allows a forced checkmate!' : '') + '</p>' +
        (reply ? `<p>Your opponent can answer <b>${esc(moveLabel(ply + 1, reply.san))}</b>${reply.why ? `: ${esc(reply.why.charAt(0).toLowerCase() + reply.why.slice(1))}` : '.'}</p>` : '') +
        (res.materialChange <= -1 ? `<p>By the end of this line you are down <b>${materialWords(res.materialChange)}</b>.</p>` : '');
    }
    const line = res.steps.map((st, i) => {
      const p = ply + 1 + i;
      return `<span class="ref-mv ${st.color === res.us ? 'mine' : 'theirs'}" data-i="${i}">${esc(p % 2 === 0 || i === 0 ? moveLabel(p, st.san) : st.san)}</span>`;
    }).join(' ');
    el.innerHTML = `${title}<div class="coach-entry mistake${playable ? ' alt' : ''}">
        <div class="coach-title">${ours && !playable ? `${badgeHtml(item.kind, 'lg')}<b>${ours.label}</b>` : `<span class="kind kind-${playable ? 'playable' : res.kind.toLowerCase()}">${kind}</span>`} ${esc(moveLabel(ply, played))}</div>
        ${verdict}
        ${res.steps.length && !playable ? `<div class="ref-line"><span class="muted">What can happen:</span> ${line}</div>` : ''}
        <div class="coach-book"><b>Better was ${esc(moveLabel(ply, best))}</b>${bestWhy.map((r) => `<p>${esc(r)}</p>`).join('')}</div>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn small" data-rv="mine">Your move</button>
        <button class="btn small" data-rv="better">Better move</button>
        ${res.steps.length && !playable ? '<button class="btn small" data-rv="replay">▶ Replay</button>' : ''}
        ${link}
      </div>${chips}`;
    el.onclick = (e) => {
      const st = e.target.closest('.ref-mv');
      if (st) { showStep(res, Number(st.dataset.i)); return; }
      const b = e.target.closest('[data-rv]');
      if (!b) return;
      if (b.dataset.rv === 'mine') { cursor = ply + 1; rebuild(); sync(); }
      if (b.dataset.rv === 'better') {
        cursor = ply; rebuild(); sync();
        const m = new Chess(fenBefore).move(best);
        board.setArrows([{ from: m.from, to: m.to, color: 'green' }]);
      }
      if (b.dataset.rv === 'replay') replay(res);
    };
    sync();
    if (!playable && res.steps.length) replay(res);
  }

  function showStep(res, i) {
    animToken++;
    const st = res.steps[i];
    analyser.cancel();
    board.setFen(st.fenAfter, { from: st.from, to: st.to });
    board.setBadge(null);
    board.setArrows([{ from: st.from, to: st.to, color: st.color === res.us ? 'green' : 'red' }]);
    view.querySelectorAll('.review .ref-mv').forEach((x) => x.classList.toggle('cur', Number(x.dataset.i) === i));
  }

  async function replay(res) {
    const my = ++animToken;
    await sleep(900);
    for (let i = 0; i < res.steps.length; i++) {
      if (!alive || my !== animToken) return;
      showStep(res, i);
      animToken = my; // showStep bumps the token; keep this animation running
      await sleep(1100);
    }
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rv]');
    if (!b) return;
    if (b.dataset.rv === 'restart') startReview();
    if (b.dataset.rv === 'item') explain(items[Number(b.dataset.i)]);
  });

  rebuild();
  sync();
  if (review) startReview();
  return () => { alive = false; reviewToken++; window.removeEventListener('keydown', onKey); analyser.cancel(); enginePlays = null; };
}
