import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { getSettings } from '../progress.js';
import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser, findBook } from '../ui.js';
import { engineCheck, getReview, saveReview, moveLabel, mistakesOf } from '../chesscom.js';
import { CLASSES, NEGATIVE, badgeHtml, legendHtml, accuracy, accuracyClass, winProb } from '../classify.js';
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
  // Move ratings (ply -> class key) from the review or the "Rate moves" button. They apply while the
  // moves still match the ones that were rated.
  let classes = [], rated = [], ratedList = [], ratedFen = startFen;
  const gameSans = sans.slice();
  let ratedSans = gameSans;
  const sameAsRated = (i) => startFen === ratedFen && sans.slice(0, i + 1).every((s, k) => s === ratedSans[k]);
  const classOf = (i) => (classes[i] && sameAsRated(i) ? classes[i] : null);
  const setRatings = (moves, forSans) => {
    classes = []; rated = [];
    for (const m of moves) { classes[m.ply] = m.kind; rated[m.ply] = m; }
    ratedList = moves;
    ratedSans = forSans.slice();
    ratedFen = startFen;
  };
  // Who played White / Black, for the report.
  const sideName = (color) => (review ? (color === review ? 'You' : query.vs || 'Opponent') : color === 'w' ? 'White' : 'Black');

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
        <h1 style="margin:0 0 6px">${review ? 'Game analysis' : 'Analysis board'}</h1>
        <div class="muted book" style="font-size:.9rem;min-height:1.3em"></div>
      </div>
      <div class="card report" hidden></div>
      ${review ? '<div class="card review"></div>' : ''}
      <div class="card">
        <div class="engine-line"></div>
        <label class="toggle" style="margin-top:8px"><input type="checkbox" class="arrow" checked> Show best move arrow</label>
      </div>
      <div class="card">
        <div class="move-verdict" hidden></div>
        <div class="movelist"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn small" data-act="flip">⇅ Flip</button>
          <button class="btn small" data-act="reset">New</button>
          ${review ? '' : '<button class="btn small" data-act="rate" title="Stockfish rates every move: Top move, Mistake, Blunder…">★ Rate moves</button>'}
        </div>
        <div class="rate-status muted" style="font-size:.85rem;margin-top:6px" hidden></div>
        <div class="key-wrap" style="margin-top:8px" hidden>${legendHtml()}</div>
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
    const badges = sans.map((_, i) => badgeHtml(classOf(i)));
    renderMoveList($('.movelist'), sans, (i) => { cursor = i + 1; rebuild(); sync(); }, cursor - 1, badges);
    $('.key-wrap').hidden = !badges.some(Boolean);
    renderReport();
    renderVerdict();
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

  // ---------------- Game report: accuracy, evaluation graph, label counts ----------------
  const REPORT = ['masterstroke', 'only', 'top', 'solid', 'theory', 'dubious', 'mistake', 'blunder'];
  function renderReport() {
    const el = $('.report');
    const show = ratedList.length && sameAsRated(ratedSans.length - 1) && sans.length >= ratedSans.length;
    el.hidden = !show;
    if (!show) return;
    const firstTurn = startFen.split(' ')[1];
    const colorOf = (ply) => ((ply % 2 === 0) === (firstTurn === 'w') ? 'w' : 'b');
    const sides = ['w', 'b'].filter((c) => ratedList.some((m) => colorOf(m.ply) === c));
    const acc = Object.fromEntries(sides.map((c) => [c, accuracy(ratedList.filter((m) => colorOf(m.ply) === c))]));
    const count = (c, k) => ratedList.filter((m) => colorOf(m.ply) === c && m.kind === k).length;
    const rows = REPORT.filter((k) => sides.some((c) => count(c, k))).map((k) =>
      `<tr>${sides.map((c, i) => `${i === 1 ? `<td class="gr-c">${badgeHtml(k)} ${CLASSES[k].label}</td>` : ''}<td>${count(c, k) || '–'}</td>`).join('')}${sides.length === 1 ? `<td class="gr-c">${badgeHtml(k)} ${CLASSES[k].label}</td>` : ''}</tr>`).join('');
    const accHtml = sides.map((c) => `<div class="acc-box${review && c === review ? ' me' : ''}">
        <div class="acc-n ${accuracyClass(acc[c])}">${acc[c] == null ? '–' : acc[c].toFixed(1)}<small>%</small></div>
        <div class="acc-l">${c === 'w' ? '⚪' : '⚫'} ${esc(sideName(c))}</div></div>`).join('');
    el.innerHTML = `<h2 style="margin:0 0 8px;font-size:1.05rem">Game report</h2>
      <div class="acc-row" title="Accuracy: how close the moves were to Stockfish's best moves (100% = always the engine's choice)">${accHtml}</div>
      <div class="muted" style="font-size:.78rem;margin:2px 0 8px">Accuracy: how close the moves were to Stockfish's best, from the winning chances each move gave away.</div>
      ${graphHtml()}
      <table class="greport" style="margin-top:8px"><thead><tr>${sides.length === 2
        ? `<th>${esc(sideName(sides[0]))}</th><th></th><th>${esc(sideName(sides[1]))}</th>`
        : `<th>${esc(sideName(sides[0]))}</th><th></th>`}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // Evaluation graph over the whole game (White's winning chances); click it to jump to a move.
  function graphHtml() {
    const n = ratedSans.length;
    const known = [];
    for (const m of ratedList) if (m.wv !== undefined) known[m.ply] = m.wv;
    const end = ratedList.at(-1)?.wvEnd;
    if (end !== undefined) known[n] = end;
    if (!known.some((v) => v !== undefined) || n < 2) return '';
    const W = 300, H = 70;
    let last = 0;
    const pts = [];
    for (let p = 0; p <= n; p++) {
      if (known[p] !== undefined) last = known[p];
      pts.push([(p / n) * W, H * (1 - winProb(last))]);
    }
    const area = `M0,${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
    const dots = ratedList.filter((m) => ['mistake', 'blunder'].includes(m.kind) || m.kind === 'masterstroke').map((m) => {
      const [x, y] = pts[m.ply + 1];
      const col = m.kind === 'masterstroke' ? '#e0a106' : CLASSES[m.kind].color;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${col}" stroke="var(--panel)" stroke-width="1"><title>${esc(moveLabel(m.ply, m.san))} · ${CLASSES[m.kind].label}</title></circle>`;
    }).join('');
    const cx = (Math.min(cursor, n) / n) * W;
    return `<svg class="eval-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evaluation graph: White's winning chances move by move">
      <rect width="${W}" height="${H}" fill="var(--graph-b)"/>
      <path d="${area}" fill="var(--graph-w)"/>
      <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--muted)" stroke-width=".6" stroke-dasharray="3 3" opacity=".7"/>
      <line x1="${cx}" x2="${cx}" y1="0" y2="${H}" stroke="var(--accent)" stroke-width="1.6"/>
      ${dots}</svg>`;
  }

  // What Stockfish said about the move on the board.
  function renderVerdict() {
    const el = $('.move-verdict');
    const ply = cursor - 1;
    const m = ply >= 0 && classOf(ply) ? rated[ply] : null;
    el.hidden = !m;
    if (!m) return;
    const c = CLASSES[m.kind];
    let txt;
    if (m.kind === 'theory') txt = 'Book move from the trainer\'s repertoire.';
    else if (NEGATIVE.includes(m.kind)) txt = `Costs about <b>${(m.loss / 100).toFixed(1)}</b> pawns. Best was <b>${esc(m.best)}</b>.`;
    else if (m.kind === 'solid') txt = m.best ? `Stockfish slightly preferred <b>${esc(m.best)}</b>.` : esc(c.desc);
    else txt = esc(c.desc);
    el.innerHTML = `${badgeHtml(m.kind, 'lg')}<div><b>${esc(moveLabel(ply, m.san))} · ${c.label}</b><div class="muted" style="font-size:.85rem">${txt}</div></div>`;
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
      case 'reset': startFen = START; sans = []; cursor = 0; classes = []; ratedList = []; break;
      case 'rate': rateMoves(); return;
      case 'load': {
        const v = $('.fen').value.trim();
        if (!v) return;
        classes = []; ratedList = [];
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

  $('.report').addEventListener('click', (e) => {
    const svg = e.target.closest('.eval-graph');
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    cursor = Math.max(0, Math.min(sans.length, Math.round(((e.clientX - r.left) / r.width) * ratedSans.length)));
    rebuild(); sync();
  });

  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { cursor = Math.max(0, cursor - 1); rebuild(); sync(); }
    if (e.key === 'ArrowRight') { cursor = Math.min(sans.length, cursor + 1); rebuild(); sync(); }
  };
  window.addEventListener('keydown', onKey);

  // ---------------- Rate moves (free analysis) ----------------
  async function rateMoves() {
    if (reviewBusy || !sans.length) return;
    const btn = view.querySelector('[data-act=rate]'), status = $('.rate-status');
    const forSans = sans.slice();
    reviewBusy = true;
    analyser.cancel();
    btn.disabled = true; status.hidden = false;
    let moves = null;
    try {
      moves = await engineCheck(engine, { sans: forSans, startFen }, {
        onStep: (done, total) => { status.textContent = `Rating moves… ${Math.round((total ? done / total : 1) * 100)}%`; },
      });
    } catch { moves = null; }
    if (!alive) return;
    reviewBusy = false; btn.disabled = false;
    if (moves) { setRatings(moves, forSans); status.hidden = true; }
    else status.textContent = 'Rating was interrupted. Try again.';
    sync();
  }

  // ---------------- Game review ----------------
  const fenAt = (ply) => { const c = new Chess(startFen); for (const s of sans.slice(0, ply)) c.move(s); return c.fen(); };
  const uciToSan = (fen, u) => { try { return new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch { return ''; } };
  let items = []; // moves worth looking at: engine mistakes + the move where you left the book

  async function startReview() {
    const el = $('.review');
    const title = `<h2 style="margin:0 0 6px">Game review${query.vs ? ` vs ${esc(query.vs)}` : ''}</h2>`;
    const saved = getReview(query.url);
    let errs = saved?.full ? saved.moves : null;
    if (!errs) {
      reviewBusy = true;
      analyser.cancel();
      el.innerHTML = `${title}<p class="muted"><span class="spinner"></span> Stockfish is rating every move of the game… <span class="pct"></span></p>
        <div class="progressbar"><span></span></div>`;
      const fill = el.querySelector('.progressbar span'), pct = el.querySelector('.pct');
      try {
        errs = await engineCheck(engine, { sans: gameSans, color: review }, {
          both: true,
          onStep: (done, total) => { const f = total ? done / total : 1; fill.style.width = `${f * 100}%`; pct.textContent = `${Math.round(f * 100)}%`; },
        });
        saveReview(query.url, errs);
      } catch { errs = null; }
      if (!alive) return;
      reviewBusy = false;
      if (!errs) {
        el.innerHTML = `${title}<p class="bad">The review was interrupted.</p><button class="btn small primary" data-rv="restart">↺ Run it again</button>`;
        sync();
        return;
      }
    }
    setRatings(errs, gameSans);
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
      el.innerHTML = `${title}<p class="good">No significant mistakes in this game. 👏</p>
        <p class="muted" style="margin-bottom:0">Step through the game with ◀ ▶ to see how each move was rated.</p>`;
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

    const n = Math.min(items.length, 12);
    const chips = items.length && (items.length > 1 || !items.includes(item))
      ? `<div style="margin-top:10px"><span class="muted" style="font-size:.85rem">Your moves to look at (worst first):</span>
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
