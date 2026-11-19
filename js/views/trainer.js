import { getOpening, lineMoves } from '../openings.js';
import { recordLine, pickLine, lineStats, getSettings, setSetting } from '../progress.js';
import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { explainMove, noteFor, analyseMistake, materialWords } from '../coach.js';
import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser } from '../ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;

export function render(root, { id, query }) {
  const opening = getOpening(id);
  if (!opening) { root.appendChild(h('<p>Opening not found. <a href="#/">Back</a></p>')); return; }

  let mode = query.mode === 'learn' ? 'learn' : 'practice';
  let fixedLine = query.line !== undefined && query.line !== '' ? Number(query.line) : null;
  const userColor = opening.side;
  const settings = getSettings();
  if (settings.coach === undefined) setSetting('coach', true);
  const engine = getEngine();

  const view = h(`<div class="play-layout">
    <div><div class="board-wrap"><div class="board"></div></div></div>
    <aside class="side">
      <div class="card">
        <div class="kv" style="align-items:center"><h1 style="margin:0">${esc(opening.name)}</h1>
          <span class="tag ${userColor}">You play ${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <div class="btn-row" style="margin:10px 0">
          <button class="btn small" data-mode="learn">Learn</button>
          <button class="btn small" data-mode="practice">Practice</button>
        </div>
        <select class="input line-select" aria-label="Line">
          <option value="">Auto – spaced repetition</option>
          ${opening.lines.map((l, i) => `<option value="${i}">${i + 1}. ${esc(l.name)}</option>`).join('')}
        </select>
      </div>
      <div class="card">
        <div class="status"></div>
        <div class="muted line-info" style="font-size:.85rem;margin:6px 0"></div>
        <div class="movelist"></div>
      </div>
      <div class="card coach">
        <div class="coach-head"><span class="coach-avatar">🎓</span><b>Coach</b>
          <label class="toggle" style="margin-left:auto"><input type="checkbox" class="coachtoggle"> On</label></div>
        <div class="coach-body"></div>
      </div>
      <div class="card btn-row">
        <button class="btn small" data-act="hint">💡 Hint</button>
        <button class="btn small" data-act="restart">↺ Restart</button>
        <button class="btn small primary" data-act="next">Next line →</button>
        <button class="btn small" data-act="playon">Play on vs Stockfish</button>
        <button class="btn small" data-act="analyse">Open in analysis</button>
        <button class="btn small" data-act="flip">⇅ Flip</button>
      </div>
      <div class="card">
        <label class="toggle"><input type="checkbox" class="evaltoggle"> Show evaluation bar</label>
        <div class="engine-line" style="margin-top:8px"></div>
      </div>
    </aside>
  </div>`);
  root.appendChild(view);

  const $ = (s) => view.querySelector(s);
  const statusEl = $('.status'), moveListEl = $('.movelist'), lineInfoEl = $('.line-info'), engineLineEl = $('.engine-line');
  const coachBody = $('.coach-body');
  const bar = new EvalBar();
  $('.board-wrap').prepend(bar.el);

  let chess = new Chess();
  let lineIdx = 0, moves = [], mistakes = 0, tries = 0, phase = 'book', busy = false;
  let coachToken = 0; // invalidates running coach analysis / playback
  let alive = true;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  const board = new Board($('.board'), {
    orientation: userColor,
    getDests: destsFn(chess),
    canMove: (color) => !busy && color === userColor && chess.turn() === userColor && phase !== 'done',
    onMove: (from, to, promo) => userMove(from, to, promo),
  });
  const analyser = makeAnalyser(engine, bar, engineLineEl, null);

  function setStatus(text, cls = '') { statusEl.className = 'status ' + cls; statusEl.innerHTML = text; }
  const coachOn = () => settings.coach !== false;

  // ---------------- Coach panel ----------------
  let coachEntries = [];
  function coachRender() {
    $('.coach').classList.toggle('off', !coachOn());
    if (!coachOn()) { coachBody.innerHTML = '<p class="muted">Coach is off. Turn it on for move explanations.</p>'; return; }
    coachBody.innerHTML = coachEntries.slice(-3).reverse().map((e) => e.html).join('') ||
      '<p class="muted">Make a move. I\'ll explain the ideas as we go.</p>';
  }
  function coachPush(html) { coachEntries.push({ html }); coachRender(); }

  function explainEntry(sansBefore, san, who) {
    const c = new Chess();
    let prev = null;
    for (const s of sansBefore) { const m = c.move(s); prev = { to: m.to, captured: m.captured }; }
    // Theory notes come first; the rule-based explainer is only a fallback for moves without one.
    const note = noteFor([...sansBefore, san]);
    const reasons = note ? [] : explainMove(c.fen(), san, { prev }, 2);
    const label = moveNo(sansBefore.length, san);
    const title = who === 'you' ? `✓ Why <b>${esc(label)}</b> is good`
      : who === 'next' ? `Your move: <b>${esc(label)}</b>`
        : `Opponent played <b>${esc(label)}</b>`;
    return `<div class="coach-entry ${who}">
      <div class="coach-title">${title}</div>
      ${note ? `<p class="coach-idea">${esc(note)}</p>` : ''}
      ${reasons.length ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function coachIntro() {
    coachEntries = [{ html: `<div class="coach-entry intro"><div class="coach-title">The plan</div>
      <p class="coach-idea">${esc(opening.description)}</p>
      ${opening.levelNote ? `<p class="muted" style="margin:6px 0 0;font-size:.85rem">${esc(opening.levelNote)}</p>` : ''}
      ${opening.source ? `<p style="margin:8px 0 0;font-size:.85rem"><a href="${esc(opening.source)}" target="_blank" rel="noopener">📚 Read more about the ${esc(opening.name)}</a></p>` : ''}</div>` }];
    coachRender();
  }

  // ---------------- Board / state ----------------
  function sync() {
    board.getDests = destsFn(chess);
    board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
    renderMoveList(moveListEl, chess.history());
    const ply = chess.history().length;
    if (phase === 'book' && mode === 'learn' && chess.turn() === userColor && moves[ply]) showArrow(moves[ply]);
    else board.setArrows([]);
    evaluate();
    updateButtons();
  }

  function evaluate() {
    bar.setVisible(settings.evalBar);
    bar.setOrientation(board.orientation);
    engineLineEl.style.visibility = (phase === 'book' && mode === 'practice') ? 'hidden' : 'visible';
    if (settings.evalBar) analyser.run(chess.fen(), { depth: 14 });
    else analyser.cancel();
  }

  function showArrow(san) {
    const c = new Chess(chess.fen());
    const m = c.move(san);
    board.setArrows([{ from: m.from, to: m.to }]);
  }

  function updateButtons() {
    view.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('primary', b.dataset.mode === mode));
    $('[data-act="hint"]').disabled = busy || phase !== 'book' || chess.turn() !== userColor;
    $('[data-act="playon"]').disabled = phase !== 'done';
  }

  function start(idx) {
    timers.forEach(clearTimeout); timers.clear();
    coachToken++;
    lineIdx = idx;
    moves = lineMoves(opening.lines[idx]);
    chess = new Chess();
    mistakes = 0; tries = 0; phase = 'book'; busy = false;
    $('.line-select').value = fixedLine === null ? '' : String(fixedLine);
    const st = lineStats(opening.id, idx);
    lineInfoEl.textContent = `Line ${idx + 1}/${opening.lines.length}: ${opening.lines[idx].name}` +
      (st ? ` · practised ${st.attempts}× · level ${st.box}/5` : ' · new');
    coachIntro();
    sync();
    if (userColor === 'b') { busy = true; setStatus('Watch White\'s move…'); later(opponentMove, 500); }
    else promptUser();
  }

  function promptUser() {
    const ply = chess.history().length;
    if (mode === 'learn') {
      setStatus(`Play <b>${esc(moves[ply])}</b> (shown with the arrow).`);
      if (coachOn()) coachPush(explainEntry(chess.history(), moves[ply], 'next'));
    } else setStatus('Your move. What\'s the book move here?');
  }

  /** Lines of this opening that match the current history. */
  function matchingLines(hist) {
    const out = [];
    opening.lines.forEach((l, i) => {
      const mv = lineMoves(l);
      if (mv.length > hist.length && hist.every((s, k) => mv[k] === s)) out.push({ i, mv });
    });
    return out;
  }

  function userMove(from, to, promo) {
    const fenBefore = chess.fen();
    const histBefore = chess.history();
    let m;
    try { m = chess.move({ from, to, promotion: promo || 'q' }); } catch { return sync(); }

    if (phase === 'free') { sync(); if (!chess.isGameOver()) engineReply(); else gameOverStatus(); return; }

    const ply = histBefore.length;
    const expected = moves[ply];
    if (m.san !== expected) {
      const sib = fixedLine === null ? matchingLines(histBefore).find((x) => x.mv[ply] === m.san && x.i !== lineIdx) : null;
      if (sib) {
        lineIdx = sib.i; moves = sib.mv;
        lineInfoEl.textContent = `Line ${sib.i + 1}/${opening.lines.length}: ${opening.lines[sib.i].name}`;
      } else {
        chess.undo();
        if (tries === 0) mistakes++;
        tries++;
        board.flash();
        const bookSans = fixedLine === null
          ? [...new Set(matchingLines(histBefore).map((x) => x.mv[ply]))]
          : [expected];
        if (!bookSans.includes(expected)) bookSans.unshift(expected);
        if (coachOn()) coachMistake(fenBefore, m, bookSans, expected);
        else wrongMoveStatus(m.san, expected);
        return;
      }
    }
    tries = 0;
    sync();
    setStatus(`✓ ${esc(m.san)}: correct!`, 'good');
    if (coachOn()) coachPush(explainEntry(histBefore, m.san, 'you'));
    if (chess.history().length >= moves.length) return complete();
    busy = true;
    updateButtons();
    later(opponentMove, 650);
  }

  function wrongMoveStatus(san, expected) {
    sync();
    if (tries >= 2 || mode === 'learn') {
      showArrow(expected);
      setStatus(`✗ ${esc(san)} isn't the book move. Play <b>${esc(expected)}</b>.`, 'bad');
    } else {
      setStatus(`✗ ${esc(san)} isn't in your repertoire here. Try again.`, 'bad');
    }
  }

  // ---------------- Mistake coaching ----------------
  async function coachMistake(fenBefore, played, bookSans, expected) {
    const my = ++coachToken;
    busy = true;
    updateButtons();
    analyser.cancel();
    const afterFen = (() => { const c = new Chess(fenBefore); c.move(played.san); return c; })();
    board.setFen(afterFen.fen(), { from: played.from, to: played.to }, checkSquare(afterFen));
    board.setArrows([]);
    const ply = chess.history().length;
    setStatus(`✗ ${esc(moveNo(ply, played.san))} isn't the book move.`, 'bad');
    coachBody.innerHTML = `<div class="coach-entry mistake"><div class="coach-title">Let's look at ${esc(moveNo(ply, played.san))}…</div>
      <p class="muted"><span class="spinner"></span> Checking what this move allows</p></div>`;

    let res = null;
    try { res = await analyseMistake(engine, fenBefore, played.san, bookSans); } catch { res = null; }
    if (!alive || my !== coachToken) return;
    if (!res) { busy = false; wrongMoveStatus(played.san, expected); coachRender(); return; }

    const bookNote = noteFor([...chess.history(), expected]);
    const bookWhy = bookNote ? [bookNote] : explainMove(chess.fen(), expected, {}, 2);
    const playedNote = noteFor([...chess.history(), played.san]); // in case it's a known (non-repertoire) move
    const pawns = (res.loss / 100).toFixed(1);
    const reply = res.steps[0];
    let verdict;
    if (res.kind === 'Playable') {
      verdict = `<p>Not a bad move: Stockfish rates it ${res.loss < 15 ? 'about as good as' : `only ${pawns} pawns worse than`} the book move. But it isn't your repertoire move, so let's stick to the plan.</p>` +
        (playedNote ? `<p class="muted">About ${esc(played.san)}: ${esc(playedNote)}</p>` : '');
    } else {
      verdict = `<p><b>${esc(played.san)}</b> is ${res.kind === 'Inaccuracy' ? 'an' : 'a'} <b>${res.kind.toLowerCase()}</b>, costing about <b>${pawns}</b> pawns.` +
        (res.mateAgainst ? ' It even allows a forced checkmate!' : '') + '</p>' +
        (reply ? `<p>Your opponent answers <b>${esc(moveNo(ply + 1, reply.san))}</b>${reply.why ? `: ${esc(reply.why.charAt(0).toLowerCase() + reply.why.slice(1))}` : '.'}</p>` : '') +
        (res.materialChange <= -1 ? `<p>By the end of this line you are down <b>${materialWords(res.materialChange)}</b>.</p>` : '');
    }
    const line = res.steps.map((s, i) => {
      const p = ply + 1 + i;
      const label = p % 2 === 0 ? moveNo(p, s.san) : i === 0 ? moveNo(p, s.san) : s.san;
      return `<span class="ref-mv ${s.color === res.us ? 'mine' : 'theirs'}" data-i="${i}">${esc(label)}</span>`;
    }).join(' ');

    coachBody.innerHTML = `<div class="coach-entry mistake">
      <div class="coach-title"><span class="kind kind-${res.kind.toLowerCase()}">${res.kind}</span> ${esc(moveNo(ply, played.san))}</div>
      ${verdict}
      ${res.steps.length && res.kind !== 'Playable' ? `<div class="ref-line"><span class="muted">What can happen:</span> ${line}</div>` : ''}
      <div class="coach-better"><b>Why ${esc(moveNo(ply, expected))} is better</b><ul>${bookWhy.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
      <div class="btn-row" style="margin-top:10px">
        ${res.steps.length && res.kind !== 'Playable' ? '<button class="btn small" data-coach="replay">▶ Replay</button>' : ''}
        <button class="btn small primary" data-coach="retry">↺ Try again</button>
      </div>
    </div>`;
    coachBody.querySelector('[data-coach="retry"]').addEventListener('click', () => retry(expected));
    coachBody.querySelector('[data-coach="replay"]')?.addEventListener('click', () => playRefutation(res, played));
    coachBody.querySelectorAll('.ref-mv').forEach((el) => el.addEventListener('click', () => showStep(res, Number(el.dataset.i))));
    if (res.kind !== 'Playable' && res.steps.length) playRefutation(res, played);
  }

  function showStep(res, i) {
    coachToken++;
    const s = res.steps[i];
    board.setFen(s.fenAfter, { from: s.from, to: s.to });
    board.setArrows([{ from: s.from, to: s.to, color: s.color === res.us ? 'green' : 'red' }]);
    coachBody.querySelectorAll('.ref-mv').forEach((el) => el.classList.toggle('cur', Number(el.dataset.i) === i));
  }

  async function playRefutation(res, played) {
    const my = ++coachToken;
    board.setFen(res.fenAfterPlayed, { from: played.from, to: played.to });
    board.setArrows([]);
    await sleep(700);
    for (let i = 0; i < res.steps.length; i++) {
      if (!alive || my !== coachToken) return;
      const s = res.steps[i];
      board.setFen(s.fenAfter, { from: s.from, to: s.to });
      board.setArrows([{ from: s.from, to: s.to, color: s.color === res.us ? 'green' : 'red' }]);
      coachBody.querySelectorAll('.ref-mv').forEach((el) => el.classList.toggle('cur', Number(el.dataset.i) === i));
      await sleep(1100);
    }
  }

  function retry(expected) {
    coachToken++;
    busy = false;
    coachRender();
    wrongMoveStatus('That move', expected);
    if (tries >= 2 || mode === 'learn') setStatus(`Try again. The book move is <b>${esc(expected)}</b>.`, 'bad');
    else setStatus('Try again. Find the book move!', 'bad');
  }

  // ---------------- Opponent / engine ----------------
  function opponentMove() {
    busy = false;
    const ply = chess.history().length;
    const hist = chess.history();
    chess.move(moves[ply]);
    if (coachOn()) coachPush(explainEntry(hist, moves[ply], 'opp'));
    sync();
    if (chess.history().length >= moves.length) return complete();
    promptUser();
  }

  function complete() {
    phase = 'done';
    busy = false;
    if (mode === 'practice') {
      const s = recordLine(opening.id, lineIdx, mistakes);
      setStatus(mistakes === 0
        ? `🎉 Line complete with no mistakes! (level ${s.box}/5)`
        : `Line complete with ${mistakes} mistake${mistakes > 1 ? 's' : ''}. It will come back sooner for review.`,
        mistakes === 0 ? 'good' : '');
    } else {
      setStatus('🎓 End of the line! Switch to Practice to test yourself.', 'good');
    }
    sync();
  }

  async function engineReply() {
    busy = true;
    setStatus('Stockfish is thinking…');
    const fen = chess.fen();
    const res = await engine.analyse(fen, { movetime: 800 });
    busy = false;
    if (phase !== 'free' || chess.fen() !== fen) return;
    if (res.bestmove) {
      chess.move({ from: res.bestmove.slice(0, 2), to: res.bestmove.slice(2, 4), promotion: res.bestmove[4] });
    }
    sync();
    if (chess.isGameOver()) gameOverStatus(); else setStatus('Your move.');
  }

  function gameOverStatus() {
    setStatus(chess.isCheckmate() ? (chess.turn() === userColor ? 'Checkmate. Stockfish wins.' : 'Checkmate. You win! 🏆') : 'Draw.');
  }

  // ---------------- Controls ----------------
  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.coach) return;
    if (b.dataset.mode) { mode = b.dataset.mode; start(lineIdx); return; }
    switch (b.dataset.act) {
      case 'hint': {
        const ply = chess.history().length;
        if (tries === 0) mistakes++;
        tries = Math.max(tries, 1);
        showArrow(moves[ply]);
        setStatus(`Hint: play <b>${esc(moves[ply])}</b>.`);
        if (coachOn()) coachPush(explainEntry(chess.history(), moves[ply], 'next'));
        break;
      }
      case 'restart': start(lineIdx); break;
      case 'next': start(fixedLine !== null ? fixedLine : pickLine(opening, lineIdx)); break;
      case 'playon':
        phase = 'free';
        coachToken++;
        coachEntries = [{ html: '<div class="coach-entry"><p class="muted">The coach covers the opening only. You\'re out of book now, so play on and use the eval bar.</p></div>' }];
        coachRender();
        setStatus('Free play against Stockfish: the book is over, so keep going!');
        sync();
        if (chess.turn() !== userColor) engineReply();
        break;
      case 'analyse': location.hash = `#/analysis?moves=${encodeURIComponent(chess.history().join(' '))}`; break;
      case 'flip': board.flip(); bar.setOrientation(board.orientation); break;
    }
  });
  $('.line-select').addEventListener('change', (e) => {
    fixedLine = e.target.value === '' ? null : Number(e.target.value);
    start(fixedLine !== null ? fixedLine : pickLine(opening));
  });
  const toggle = $('.evaltoggle');
  toggle.checked = settings.evalBar;
  toggle.addEventListener('change', () => { setSetting('evalBar', toggle.checked); evaluate(); });
  const ctoggle = $('.coachtoggle');
  ctoggle.checked = coachOn();
  ctoggle.addEventListener('change', () => { setSetting('coach', ctoggle.checked); coachRender(); });

  start(fixedLine !== null ? fixedLine : pickLine(opening));

  return () => { alive = false; coachToken++; timers.forEach(clearTimeout); analyser.cancel(); phase = 'gone'; };
}
