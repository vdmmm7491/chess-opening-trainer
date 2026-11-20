import { getOpening, lineMoves } from '../openings.js';
import { recordLine, pickLine, lineStats, getSettings, setSetting, quizUnlocked, linesLearned, QUIZ_UNLOCK } from '../progress.js';
import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { explainMove, noteFor, analyseMistake } from '../coach.js';
import { badgeHtml } from '../classify.js';
import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser } from '../ui.js';

const BOOK_TAG = '<span class="kind kind-book">Book move</span>';
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
          <a class="btn small quiz-link" href="#/quiz/${opening.id}">🧩 Quiz</a>
        </div>
        <select class="input line-select" aria-label="Line">
          <option value="">Auto – spaced repetition</option>
          ${opening.lines.map((l, i) => `<option value="${i}">${i + 1}. ${esc(l.name)}</option>`).join('')}
        </select>
      </div>
      <div class="card status-card">
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
    const title = who === 'you' ? `${BOOK_TAG} ✓ <b>${esc(label)}</b>`
      : who === 'next' ? `${BOOK_TAG} Your move: <b>${esc(label)}</b>`
        : `${BOOK_TAG} Opponent played <b>${esc(label)}</b>`;
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
    const hist = chess.history();
    // Every move that follows the line is a book move; free play after the line gets no badge.
    renderMoveList(moveListEl, hist, null, undefined, hist.map((_, i) => (i < moves.length ? badgeHtml('theory') : '')));
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
    const q = $('.quiz-link');
    const open = quizUnlocked(opening);
    q.classList.toggle('locked', !open);
    q.textContent = open ? '🧩 Quiz' : `🔒 Quiz ${linesLearned(opening)}/${QUIZ_UNLOCK}`;
    q.title = open ? '' : `Complete ${QUIZ_UNLOCK} lines in Practice to unlock`;
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
    setStatus(`✓ ${esc(m.san)} ${BOOK_TAG}`, 'good');
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

  // ---------------- Mistake label ----------------
  // A wrong move only gets a label (Blunder, Mistake, …): no explanation of why it's bad.
  const KIND_LABEL = { Blunder: 'Blunder', Mistake: 'Mistake', Inaccuracy: 'Inaccuracy', Playable: 'Not the book move' };
  function mistakeCard(ply, san, tag, expected) {
    coachBody.innerHTML = `<div class="coach-entry mistake">
      <div class="coach-title">${tag} ${esc(moveNo(ply, san))}</div>
      <button class="btn primary retry-btn" data-coach="retry">↺ Try again</button>
    </div>`;
    coachBody.querySelector('[data-coach="retry"]').addEventListener('click', () => retry(expected));
  }

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
    mistakeCard(ply, played.san, '<span class="muted"><span class="spinner"></span> Rating…</span>', expected);

    let res = null;
    try { res = await analyseMistake(engine, fenBefore, played.san, bookSans); } catch { res = null; }
    if (!alive || my !== coachToken) return;
    if (!res) { busy = false; wrongMoveStatus(played.san, expected); coachRender(); return; }

    const label = KIND_LABEL[res.kind] || res.kind;
    const tag = `<span class="kind kind-${res.kind.toLowerCase()}">${esc(label)}</span>`;
    setStatus(`✗ ${esc(moveNo(ply, played.san))} ${tag}`, 'bad');
    mistakeCard(ply, played.san, tag, expected);
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
      const wasLocked = !quizUnlocked(opening);
      const s = recordLine(opening.id, lineIdx, mistakes);
      const justUnlocked = wasLocked && quizUnlocked(opening);
      setStatus(mistakes === 0
        ? `🎉 Line complete with no mistakes! (level ${s.box}/5)`
        : `Line complete with ${mistakes} mistake${mistakes > 1 ? 's' : ''}. It will come back sooner for review.`,
        mistakes === 0 ? 'good' : '');
      if (justUnlocked) {
        $('.status').insertAdjacentHTML('beforeend',
          `<div class="unlock">🧩 Quiz unlocked! <a href="#/quiz/${opening.id}">Test yourself now →</a></div>`);
      }
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
