// Quiz: random positions from one opening (move 3 onwards); find the book move.
import { getOpening, lineMoves } from '../openings.js';
import { recordQuiz, quizStats, quizUnlocked, linesLearned, QUIZ_UNLOCK } from '../progress.js';
import { Board } from '../board.js';
import { noteFor } from '../coach.js';
import { h, esc, Chess, destsFn, checkSquare, lastMoveOf, renderMoveList } from '../ui.js';

const ROUND = 10;
const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;

/** Every position in the opening where it's your move, from move 3 on, with all book answers. */
export function quizPositions(opening) {
  const map = new Map();
  opening.lines.forEach((line) => {
    const mv = lineMoves(line);
    for (let ply = 4; ply < mv.length; ply++) { // ply 4 = move 3 for White; ply 5 = move 3 for Black
      const myTurn = (ply % 2 === 0) === (opening.side === 'w');
      if (!myTurn) continue;
      const key = mv.slice(0, ply).join(' ');
      const e = map.get(key) || { history: mv.slice(0, ply), answers: new Set(), lines: new Set() };
      e.answers.add(mv[ply]);
      e.lines.add(line.name);
      map.set(key, e);
    }
  });
  return [...map.values()];
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
        <div class="kv" style="align-items:center"><h1 style="margin:0">🧩 ${esc(opening.name)} quiz</h1>
          <span class="tag ${userColor}">You play ${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <p class="muted" style="margin:8px 0 0;font-size:.9rem">Random positions from all ${opening.lines.length} lines (move 3 onwards). Find the book move. You get one try.</p>
        <div class="btn-row" style="margin-top:10px">
          <a class="btn small" href="#/train/${opening.id}?mode=learn">Learn</a>
          <a class="btn small" href="#/train/${opening.id}?mode=practice">Practice</a>
        </div>
      </div>
      <div class="card status-card">
        <div class="quiz-head"><b>🧩 ${esc(opening.name)}</b><span class="tag ${userColor}">${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <div class="quiz-progress"><span class="q-num"></span><span class="q-score"></span><span class="quiz-best muted"></span></div>
        <div class="bar" style="margin:8px 0"><span class="q-bar" style="width:0"></span></div>
        <div class="status"></div>
        <div class="movelist" style="margin-top:6px"></div>
      </div>
      <div class="card coach">
        <div class="coach-head"><span class="coach-avatar">🎓</span><b>Coach</b></div>
        <div class="coach-body"><p class="muted">Find the book move. I'll explain the answer afterwards.</p></div>
      </div>
      <nav class="card btn-row quiz-actions" aria-label="Quiz actions">
        <button class="btn small primary" data-act="next" disabled>Next question →</button>
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

  function setStatus(html, cls = '') { const s = $('.status'); s.className = 'status ' + cls; s.innerHTML = html; }

  function newRound() {
    if (!all.length) { setStatus('This opening has no quiz positions yet.'); return; }
    // Avoid repeats inside a round; if an opening has fewer than 10 positions, use them all.
    questions = shuffle([...all]).slice(0, Math.min(ROUND, all.length));
    qi = 0; score = 0;
    showQuestion();
  }

  function showQuestion() {
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
    setStatus(`${userColor === 'w' ? 'White' : 'Black'} to move after <b>${esc(moveNo(last, q.history[last]))}</b>. What's the book move?`);
    coachBody.innerHTML = `<p class="muted">From the line${q.lines.size > 1 ? 's' : ''}: ${esc([...q.lines].join(', '))}.</p>`;
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
      setStatus(`✗ ${esc(m.san)} isn't the book move. The answer is <b>${esc(right)}</b>.`, 'bad');
    }
    const ply = q.history.length;
    const notes = [...q.answers].map((a) => ({ san: a, note: noteFor([...q.history, a]) }));
    coachBody.innerHTML = notes.map((n) => `<div class="coach-entry ${correct ? 'you' : 'next'}">
      <div class="coach-title">Why <b>${esc(moveNo(ply, n.san))}</b>${notes.length > 1 ? ' (one of the book moves)' : ''}</div>
      ${n.note ? `<p class="coach-idea">${esc(n.note)}</p>` : ''}</div>`).join('');
    $('.q-score').textContent = `Score ${score}`;
    $('.q-bar').style.width = `${((qi + 1) / questions.length) * 100}%`;
    // Phones: make sure the whole explanation sits above the fixed bottom bar.
    if (matchMedia('(max-width: 900px)').matches) $('.coach').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const nextBtn = $('[data-act="next"]');
    nextBtn.disabled = false;
    nextBtn.textContent = qi + 1 < questions.length ? 'Next question →' : 'See result';
  }

  function finish() {
    const stats = recordQuiz(opening.id, score, questions.length);
    const pct = Math.round((score / questions.length) * 100);
    const msg = pct === 100 ? '🏆 Perfect round!' : pct >= 80 ? '🎉 Great job!' : pct >= 50 ? 'Good effort. Keep drilling!' : 'Keep practising this opening. Try Learn mode first.';
    setStatus(`<b>${score} / ${questions.length}</b> correct (${pct}%). ${msg}`, pct >= 80 ? 'good' : '');
    coachBody.innerHTML = `<div class="coach-entry"><div class="coach-title">Round finished</div>
      <p>Best score: <b>${stats.best} / ${stats.bestOf}</b> · rounds played: ${stats.rounds}</p></div>`;
    $('[data-act="next"]').disabled = true;
    $('[data-act="hint"]').disabled = true;
    $('.q-num').textContent = 'Finished';
    $('.quiz-best').textContent = `Best: ${stats.best} / ${stats.bestOf}`;
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'next') { if (qi + 1 < questions.length) { qi++; showQuestion(); } else finish(); }
    if (b.dataset.act === 'hint') hint();
    if (b.dataset.act === 'restart') newRound();
    if (b.dataset.act === 'flip') board.flip();
  });

  const prev = quizStats(opening.id);
  if (prev) $('.quiz-best').textContent = `Best: ${prev.best} / ${prev.bestOf}`;
  newRound();
}
