// Quiz: random positions from one opening; find the book move (move 3 onwards) or punish a mistake.
import { getOpening, linesFor, levelForRating, LEVEL_KEYS } from '../openings.js';
import { recordQuiz, quizStats, quizUnlocked, linesLearned, QUIZ_UNLOCK, getLevel } from '../progress.js';
import { Board } from '../board.js';
import { noteFor } from '../coach.js';
import { PUNISH } from '../punish.js';
import { QUIZ_PUNISH } from '../quiz-punish.js';
import { h, esc, Chess, destsFn, checkSquare, lastMoveOf, renderMoveList } from '../ui.js';

const ROUND = 10;
const AUTO_NEXT = 10000; // ms after an answer until the next question opens by itself
const AUTO_SHOW = 2000; // ms after an answer until the timer on the Next button starts to fill
const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;

/** The square a SAN move captures on, or null if it isn't a capture. */
const captureSq = (san) => san.match(/x([a-h][1-8])/)?.[1] || null;
/** Is `san` a recapture: taking back on the square where the opponent just captured? */
const isRecapture = (prev, san) => !!captureSq(prev) && captureSq(prev) === captureSq(san);

/** Every position in the opening (at your level) where it's your move, from move 3 on, with all book answers.
    Positions answered by a recapture are left out: they are too obvious to ask. */
export function quizPositions(opening, level = getLevel()) {
  const map = new Map();
  linesFor(opening, level).forEach(({ moves: mv, name }) => {
    for (let ply = 4; ply < mv.length; ply++) { // ply 4 = move 3 for White; ply 5 = move 3 for Black
      const myTurn = (ply % 2 === 0) === (opening.side === 'w');
      if (!myTurn) continue;
      const key = mv.slice(0, ply).join(' ');
      const e = map.get(key) || { history: mv.slice(0, ply), answers: new Set(), lines: new Set() };
      e.answers.add(mv[ply]);
      e.lines.add(name);
      map.set(key, e);
    }
  });
  const book = [...map.values()].filter((q) => ![...q.answers].some((a) => isRecapture(q.history.at(-1), a)));
  return [...book, ...punishPositions(opening, level)];
}

/** "Find the punishment" questions: the opponent's mistakes from Punish mode up to your level (or the
    next level up if the opening has none at yours).
    QUIZ_PUNISH lists which of the punishing moves have one clearly best answer. */
function punishPositions(opening, level) {
  const li = LEVEL_KEYS.indexOf(level);
  const levelOf = (e) => LEVEL_KEYS.indexOf(levelForRating(e.elo));
  const drills = (PUNISH[opening.id] || []).filter((e) => QUIZ_PUNISH[opening.id]?.[e.name]);
  const max = drills.some((e) => levelOf(e) <= li) ? li : li + 1;
  const out = [];
  for (const e of drills.filter((d) => levelOf(d) <= max)) {
    const setup = e.moves.split(' '), sol = e.punish.split(' ');
    for (const step of QUIZ_PUNISH[opening.id][e.name]) {
      const history = [...setup, ...sol.slice(0, step)];
      if (!sol[step] || isRecapture(history.at(-1), sol[step])) continue;
      const mistake = `${moveNo(setup.length - 1, setup.at(-1))}?`;
      out.push({ history, answers: new Set([sol[step]]), lines: new Set(), punish: { ...e, mistake, hint: e.mistake, step } });
    }
  }
  return out;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function render(root, { id }) {
  const opening = getOpening(id);
  if (!opening) { root.appendChild(h('<p>Opening not found. <a href="#/">Back</a></p>')); return; }
  if (!quizUnlocked(opening)) {
    const done = linesLearned(opening);
    root.appendChild(h(`<section class="card locked-quiz">
      <div class="lock-icon">🔒</div>
      <h1>${esc(opening.name)} quiz is locked</h1>
      <p>Complete <b>${QUIZ_UNLOCK} lines</b> of this opening in <b>Practice</b> mode to unlock the quiz. You've done <b>${done} / ${QUIZ_UNLOCK}</b>.</p>
      <div class="bar" style="margin:12px auto;max-width:320px"><span style="width:${(done / QUIZ_UNLOCK) * 100}%"></span></div>
      <div class="btn-row" style="justify-content:center">
        <a class="btn primary" href="#/train/${opening.id}?mode=practice">Practice a line</a>
        <a class="btn" href="#/train/${opening.id}?mode=learn">Learn first</a>
      </div>
    </section>`));
    return;
  }
  const all = quizPositions(opening);
  const userColor = opening.side;

  const view = h(`<div class="play-layout quiz-view">
    <div><div class="board-wrap"><div class="board"></div></div></div>
    <aside class="side">
      <div class="card quiz-intro">
        <h1 style="margin:0">🧩 ${esc(opening.name)} quiz</h1>
        <p class="muted" style="margin:8px 0 0;font-size:.9rem">Random positions from all ${linesFor(opening, getLevel()).length} lines at your level (move 3 onwards). Find the book move, or punish your opponent's mistake. You get one try.</p>
        <div class="btn-row" style="margin-top:10px">
          <a class="btn small" href="#/train/${opening.id}?mode=learn">Learn</a>
          <a class="btn small" href="#/train/${opening.id}?mode=practice">Practice</a>
        </div>
      </div>
      <div class="card status-card">
        <div class="quiz-head"><b>🧩 ${esc(opening.name)}</b></div>
        <div class="quiz-progress"><span class="q-num"></span><span class="q-score"></span><span class="quiz-best muted"></span></div>
        <div class="bar" style="margin:8px 0"><span class="q-bar" style="width:0"></span></div>
        <div class="quiz-result" hidden></div>
        <div class="status"></div>
        <div class="movelist" style="margin-top:6px"></div>
      </div>
      <div class="card coach">
        <div class="coach-head"><span class="coach-avatar">🎓</span><b>Coach</b></div>
        <div class="coach-body"><p class="muted">Find the book move. I'll explain the answer afterwards.</p></div>
      </div>
      <nav class="card btn-row quiz-actions" aria-label="Quiz actions">
        <button class="btn small primary" data-act="next" disabled>Next question →</button>
        <a class="btn small primary" data-act="home" href="#/" hidden>← Back to openings</a>
        <button class="btn small" data-act="hint">💡 Hint</button>
        <button class="btn small" data-act="restart">↺ New round</button>
        <button class="btn small" data-act="flip">⇅ Flip</button>
        <a class="btn small quiz-tab" href="#/train/${opening.id}?mode=learn">📖 Learn</a>
        <a class="btn small quiz-tab" href="#/train/${opening.id}?mode=practice">🎯 Practice</a>
      </nav>
    </aside>
  </div>`);
  root.appendChild(view);
  const $ = (s) => view.querySelector(s);
  const coachBody = $('.coach-body');

  let chess = new Chess();
  let questions = [], qi = 0, score = 0, answered = false, hinted = false;
  const board = new Board($('.board'), {
    orientation: userColor,
    getDests: destsFn(chess),
    canMove: (color) => !answered && color === userColor && chess.turn() === userColor,
    onMove: (from, to, promo) => answer(from, to, promo),
  });

  // After an answer the quiz moves on by itself; the Next button fills up as a timer.
  let autoTimer = 0;
  function stopAuto() {
    clearTimeout(autoTimer);
    $('[data-act="next"]').classList.remove('auto-next');
  }
  function startAuto() {
    stopAuto();
    const b = $('[data-act="next"]');
    b.style.setProperty('--auto-delay', `${AUTO_SHOW}ms`);
    b.style.setProperty('--auto-time', `${AUTO_NEXT - AUTO_SHOW}ms`);
    b.classList.add('auto-next');
    autoTimer = setTimeout(next, AUTO_NEXT);
  }
  function next() {
    stopAuto();
    if (qi + 1 < questions.length) { qi++; showQuestion(); }
  }
  /** After the last question the Next button makes way for "Back to openings". */
  function showFinished(on) {
    $('[data-act="next"]').hidden = on;
    $('[data-act="home"]').hidden = !on;
    $('.quiz-result').hidden = !on;
  }

  function setStatus(html, cls = '') { const s = $('.status'); s.className = 'status ' + cls; s.innerHTML = html; }

  function newRound() {
    if (!all.length) { setStatus('This opening has no quiz positions yet.'); return; }
    // Avoid repeats inside a round; if an opening has fewer than 10 positions, use them all.
    // One question per mistake: a later step of a punishment gives away the earlier one.
    const seen = new Set();
    questions = shuffle([...all]).filter((q) => {
      if (!q.punish) return true;
      const first = !seen.has(q.punish.name);
      seen.add(q.punish.name);
      return first;
    }).slice(0, ROUND);
    qi = 0; score = 0;
    showQuestion();
  }

  function showQuestion() {
    stopAuto();
    showFinished(false);
    answered = false;
    hinted = false;
    const q = questions[qi];
    chess = new Chess();
    q.history.forEach((s) => chess.move(s));
    board.getDests = destsFn(chess);
    board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
    board.setArrows([]);
    renderMoveList($('.movelist'), q.history);
    $('.movelist').scrollLeft = $('.movelist').scrollWidth; // phones: one-row strip, show the newest move
    $('.q-num').textContent = `Question ${qi + 1} / ${questions.length}`;
    $('.q-score').textContent = `Score ${score}`;
    $('.q-bar').style.width = `${(qi / questions.length) * 100}%`;
    const last = q.history.length - 1;
    if (q.punish) {
      const them = userColor === 'w' ? 'Black' : 'White';
      const lastMove = esc(moveNo(last, q.history[last]));
      setStatus(q.punish.step === 0
        ? `${them} played <b class="bad">${lastMove}?</b> Find the punishment!`
        : `You're punishing <b class="bad">${esc(q.punish.mistake)}</b> and ${them} answered <b>${lastMove}</b>. What's next?`);
      coachBody.innerHTML = `<div class="coach-entry mistake"><div class="coach-title">What's wrong with <b>${esc(q.punish.mistake)}</b></div>
        <p class="coach-idea">${esc(q.punish.hint)}</p></div>`;
    } else {
      setStatus(`${userColor === 'w' ? 'White' : 'Black'} to move after <b>${esc(moveNo(last, q.history[last]))}</b>. What's the book move?`);
      coachBody.innerHTML = `<p class="muted">From the line${q.lines.size > 1 ? 's' : ''}: ${esc([...q.lines].join(', '))}.</p>`;
    }
    $('[data-act="next"]').disabled = true;
    $('[data-act="hint"]').disabled = false;
  }

  /** Hint: highlight the piece to move. A hinted answer scores no point. */
  function hint() {
    if (answered || !questions.length) return;
    const m = new Chess(chess.fen()).move([...questions[qi].answers][0]);
    hinted = true;
    board.setHints([m.from]);
    $('[data-act="hint"]').disabled = true;
    setStatus('Hint: move the highlighted piece. A hinted answer scores no point.');
  }

  function answer(from, to, promo) {
    if (answered) return;
    const q = questions[qi];
    let m;
    try { m = chess.move({ from, to, promotion: promo || 'q' }); } catch { return; }
    answered = true;
    $('[data-act="hint"]').disabled = true;
    const correct = q.answers.has(m.san);
    const right = correct ? m.san : [...q.answers][0];
    if (correct) {
      if (!hinted) score++;
      board.getDests = destsFn(chess);
      board.setFen(chess.fen(), { from: m.from, to: m.to }, checkSquare(chess));
      setStatus(`✓ <b>${esc(m.san)}</b> is right!${hinted ? ' (with a hint, so no point)' : ''}`, 'good');
    } else {
      chess.undo();
      board.flash();
      const t = new Chess(chess.fen());
      const r = t.move(right);
      board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
      board.setArrows([{ from: r.from, to: r.to }]);
      setStatus(`✗ ${esc(m.san)} isn't the ${q.punish ? 'punishment' : 'book move'}. The answer is <b>${esc(right)}</b>.`, 'bad');
    }
    const ply = q.history.length;
    const notes = [...q.answers].map((a) => ({ san: a, note: q.punish ? q.punish.why : noteFor([...q.history, a]) }));
    coachBody.innerHTML = notes.map((n) => `<div class="coach-entry ${correct ? 'you' : 'next'}">
      <div class="coach-title">Why <b>${esc(moveNo(ply, n.san))}</b>${notes.length > 1 ? ' (one of the book moves)' : ''}</div>
      ${n.note ? `<p class="coach-idea">${esc(n.note)}</p>` : ''}</div>`).join('');
    $('.q-score').textContent = `Score ${score}`;
    $('.q-bar').style.width = `${((qi + 1) / questions.length) * 100}%`;
    // Phones: make sure the whole explanation sits above the fixed bottom bar.
    if (matchMedia('(max-width: 900px)').matches) $('.coach').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (qi + 1 === questions.length) { finish(); return; }
    $('[data-act="next"]').disabled = false;
    startAuto();
  }

  /** Round over (called with the last answer still on screen): congratulate and show the score. */
  function finish() {
    const stats = recordQuiz(opening.id, score, questions.length);
    const pct = Math.round((score / questions.length) * 100);
    const msg = pct === 100 ? 'Perfect round!' : pct >= 80 ? 'Great job!' : pct >= 50 ? 'Good effort. Keep drilling!' : 'Keep practising, you\'ll get there!';
    $('.quiz-result').innerHTML = `<b class="qr-title">${pct === 100 ? '🏆' : '🎉'} Congratulations, you finished the quiz!</b>
      <span class="qr-score">${score} / ${questions.length}</span>
      <span>${pct}% correct. ${msg}</span>
      <span class="muted">Best score: ${stats.best} / ${stats.bestOf} · rounds played: ${stats.rounds}</span>
      <a class="btn small primary qr-home" href="#/">← Back to openings</a>`;
    showFinished(true);
    $('.q-num').textContent = 'Finished';
    $('.quiz-best').textContent = `Best: ${stats.best} / ${stats.bestOf}`;
    if (matchMedia('(max-width: 900px)').matches) $('.quiz-result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'next') next();
    if (b.dataset.act === 'hint') hint();
    if (b.dataset.act === 'restart') newRound();
    if (b.dataset.act === 'flip') board.flip();
  });

  const prev = quizStats(opening.id);
  if (prev) $('.quiz-best').textContent = `Best: ${prev.best} / ${prev.bestOf}`;
  newRound();
  return stopAuto;
}
