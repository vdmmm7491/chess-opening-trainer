import { getOpening, LEVELS, linesFor } from '../openings.js';
import { recordLine, pickLine, lineStats, openingProgress, getSettings, setSetting, getLevel, setLevel, quizUnlocked, linesLearned, QUIZ_UNLOCK, recordLearned, lineUnlocked, knownPlies } from '../progress.js';
import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { PUNISH } from '../punish.js';
import { explainMove, noteFor, analyseMistake, materialWords } from '../coach.js';
import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser, progressBar, updateProgressBar } from '../ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;

export function render(root, { id, query }) {
  const opening = getOpening(id);
  if (!opening) { root.appendChild(h('<p>Opening not found. <a href="#/">Back</a></p>')); return; }

  let mode = query.mode === 'learn' ? 'learn' : 'practice';
  const userColor = opening.side;
  const settings = getSettings();
  if (settings.coach === undefined) setSetting('coach', true);
  const engine = getEngine();
  let level = getLevel();
  let lines = linesFor(opening, level); // the lines you train at your level (cut to its depth)
  const entry = (idx) => lines.find((x) => x.idx === idx);
  const posOf = (idx) => lines.findIndex((x) => x.idx === idx) + 1;

  // Desktop: coach and buttons sit right under the board so everything fits one screen.
  // Phones: board-col and side become `display: contents` and CSS `order` sets the sequence.
  const view = h(`<div class="play-layout trainer-view">
    <div class="board-col">
      <div class="board-wrap"><div class="board"></div></div>
      <div class="card coach">
        <div class="coach-head"><span class="coach-avatar">🎓</span><b>Coach</b>
          <label class="toggle" style="margin-left:auto"><input type="checkbox" class="coachtoggle"> On</label></div>
        <div class="coach-body"></div>
      </div>
      <div class="card btn-row trainer-actions">
        <button class="btn small" data-act="hint">💡 Hint</button>
        <button class="btn small" data-act="restart">↺ Restart</button>
        <button class="btn small primary" data-act="next">Next line →</button>
        <button class="btn small" data-act="playon" title="Play on against Stockfish">▶ Play on</button>
        <button class="btn small" data-act="analyse" title="Open this position in analysis">🔍 Analyse</button>
        <button class="btn small" data-act="flip">⇅ Flip</button>
      </div>
    </div>
    <dialog class="line-done" aria-labelledby="ld-title">
      <button class="ld-close" type="button" data-done="close" aria-label="Close">✕</button>
      <div class="ld-icon"></div>
      <h2 id="ld-title" class="ld-title"></h2>
      <p class="ld-sub muted"></p>
      <div class="ld-stats"></div>
      <div class="ld-extra"></div>
      <div class="ld-actions"></div>
    </dialog>
    <aside class="side">
      <div class="card">
        <div class="kv" style="align-items:center"><h1 style="margin:0">${esc(opening.name)}</h1>
          <span class="tag ${userColor}">You play ${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <label class="trainer-level muted">Level <select class="input levelsel" aria-label="Training level">${Object.entries(LEVELS).map(([k, l]) => `<option value="${k}">${esc(l.name)}</option>`).join('')}</select></label>
        <div class="trainer-progress">${progressBar(openingProgress(opening))}</div>
        <div class="btn-row" style="margin:10px 0">
          <button class="btn small" data-mode="learn">Learn</button>
          <button class="btn small" data-mode="practice">Practice</button>
          <a class="btn small quiz-link" href="#/quiz/${opening.id}">🧩 Quiz</a>
          ${PUNISH[opening.id]?.length ? `<a class="btn small punish-link" href="#/punish/${opening.id}" title="Mistakes opponents make in this line">⚔️ Punish</a>` : ''}
        </div>
      </div>
      <div class="card status-card">
        <button class="line-current" type="button" aria-haspopup="dialog">
          <span class="lc-label">📖</span><span class="lc-name"></span><span class="lc-change">Change line ▾</span></button>
        <div class="status"></div>
        <div class="muted line-info" style="font-size:.85rem;margin:6px 0"></div>
        <div class="movelist"></div>
        <div class="eval-row">
          <label class="toggle"><input type="checkbox" class="evaltoggle"> Show evaluation bar</label>
          <div class="engine-line"></div>
        </div>
      </div>
      <div class="lines-backdrop"></div>
      <div class="card lines-card" role="dialog" aria-label="Choose a line">
        <div class="lines-head"><b>📖 Choose a line</b><span class="muted lines-count"></span>
          <button class="btn small lines-close" aria-label="Close">✕</button></div>
        <div class="line-list"></div>
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
  const unlocked = () => lineUnlocked(opening.id, lineIdx, level);
  /** Your first move in this line that you don't know from a lower level yet. */
  const newFrom = (idx) => Math.ceil(knownPlies(opening.id, idx, level) / 2) + 1;

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

  /** Hint: highlight the piece that has to move, without showing where it goes. */
  function showHint(san) {
    const m = new Chess(chess.fen()).move(san);
    board.setArrows([]);
    board.setHints([m.from]);
  }

  function updateButtons() {
    view.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('primary', b.dataset.mode === mode));
    $('[data-act="hint"]').disabled = busy || phase !== 'book' || chess.turn() !== userColor;
    $('[data-act="playon"]').disabled = phase !== 'done';
    const pr = $('[data-mode="practice"]');
    const locked = !unlocked();
    pr.classList.toggle('locked', locked);
    pr.setAttribute('aria-disabled', String(locked));
    pr.textContent = locked ? '🔒 Practice' : 'Practice';
    pr.title = locked ? 'Play this line to the end in Learn mode to unlock' : '';
    const q = $('.quiz-link');
    const open = quizUnlocked(opening);
    q.classList.toggle('locked', !open);
    q.textContent = open ? '🧩 Quiz' : `🔒 Quiz ${linesLearned(opening)}/${QUIZ_UNLOCK}`;
    q.title = open ? '' : `Complete ${QUIZ_UNLOCK} lines in Practice to unlock`;
  }

  function start(idx, fromMoveOne = false) {
    closeDone();
    timers.forEach(clearTimeout); timers.clear();
    coachToken++;
    if (!entry(idx)) idx = pickLine(opening, -1, level, mode);
    lineIdx = idx;
    if (mode === 'practice' && !unlocked()) mode = 'learn'; // Practice is locked until the line is learned
    moves = entry(idx).moves;
    const pl = $('.punish-link');
    if (pl) pl.href = `#/punish/${opening.id}?line=${idx}`; // Punish opens on the line you're training
    chess = new Chess();
    mistakes = 0; tries = 0; phase = 'book'; busy = false;
    openLines(false);
    renderLineList();
    const st = lineStats(opening.id, idx, level);
    lineInfoEl.textContent = `Line ${posOf(idx)}/${lines.length}: ${entry(idx).name} · ${LEVELS[level].name}, ${Math.ceil(moves.length / 2)} moves` +
      (st ? ` · practised ${st.attempts}× · strength ${st.box}/5` : unlocked() ? ' · learned' : knownPlies(opening.id, idx, level) ? ` · new from move ${newFrom(idx)}, 🔒 learn it to unlock Practice` : ' · new, 🔒 learn it to unlock Practice');
    coachIntro();
    // Learn skips the moves you know from a lower level (Restart plays them too).
    const known = mode === 'learn' ? knownPlies(opening.id, idx, level) : 0;
    if (known && !fromMoveOne) {
      moves.slice(0, known).forEach((s) => chess.move(s));
      const n = Math.ceil(known / 2);
      coachPush(`<div class="coach-entry intro"><p class="coach-idea">You already know the first ${n} moves from a lower level, so Learn starts after them. ↺ Restart plays the line from move 1.</p></div>`);
      busy = true;
      sync();
      setStatus(`You know the first ${n} moves. Here's what comes next…`);
      later(opponentMove, 1200);
      return;
    }
    sync();
    if (userColor === 'b') { busy = true; setStatus('Watch White\'s move…'); later(opponentMove, 500); }
    else promptUser();
  }

  // ---------------- Line picker ----------------
  function renderLineList() {
    const list = $('.line-list');
    $('.lines-count').textContent = `${lines.length} lines · ${LEVELS[level].name}`;
    list.innerHTML = lines.map(({ idx: i, name }, n) => {
      const st = lineStats(opening.id, i, level);
      const meta = !st ? `<span class="li-new">${lineUnlocked(opening.id, i, level) ? 'Learned' : knownPlies(opening.id, i, level) ? `From move ${newFrom(i)}` : 'New'}</span>`
        : `<span class="li-level" title="Strength ${st.box}/5">${'●'.repeat(st.box)}${'○'.repeat(5 - st.box)}</span>`;
      return `<button type="button" class="line-item${i === lineIdx ? ' cur' : ''}" data-line="${i}">
        <span class="li-num">${n + 1}</span><span class="li-name">${esc(name)}</span>${meta}</button>`;
    }).join('');
    $('.lc-name').innerHTML = `<b>Line ${posOf(lineIdx)}/${lines.length}</b> ${esc(entry(lineIdx).name)}`;
    const cur = list.querySelector('.cur');
    if (cur) list.scrollTop = cur.offsetTop - list.offsetTop - list.clientHeight / 2 + cur.offsetHeight / 2;
  }
  function openLines(open) {
    $('.lines-card').classList.toggle('open', open);
    $('.lines-backdrop').classList.toggle('open', open);
    if (open) renderLineList();
  }

  function promptUser() {
    const ply = chess.history().length;
    if (mode === 'learn') {
      setStatus(`Play <b>${esc(moves[ply])}</b> (shown with the arrow).`);
      if (coachOn()) coachPush(explainEntry(chess.history(), moves[ply], 'next'));
    } else setStatus('Your move. What\'s the book move here?');
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
      chess.undo();
      if (tries === 0) mistakes++;
      tries++;
      board.flash();
      if (coachOn()) coachMistake(fenBefore, m, [expected], expected);
      else wrongMoveStatus(m.san, expected);
      return;
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
    const playable = res.kind === 'Playable';
    // Always explain the book move itself: this is what the player needs to remember.
    const bookBlock = `<div class="coach-book"><b>Why ${esc(moveNo(ply, expected))} is the book move</b>
      ${bookWhy.map((r) => `<p>${esc(r)}</p>`).join('')}</div>`;
    let verdict;
    if (playable) {
      verdict = `<p><b>${esc(played.san)}</b> is a reasonable move, but it isn't part of this repertoire. ` +
        `Stick to the book move so you get the positions you have practised.</p>` +
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

    coachBody.innerHTML = `<div class="coach-entry mistake${playable ? ' alt' : ''}">
      <div class="coach-title"><span class="kind kind-${res.kind.toLowerCase()}">${playable ? 'Not the book move' : res.kind}</span> ${esc(moveNo(ply, played.san))}</div>
      ${playable ? bookBlock : ''}
      ${verdict}
      ${(() => {
        // Replay / Try again sit on the same row as the refutation line, so the coach stays short.
        const btns = `<span class="coach-btns">
          ${res.steps.length && !playable ? '<button class="btn small" data-coach="replay">▶ Replay</button>' : ''}
          <button class="btn small primary" data-coach="retry">↺ Try again</button></span>`;
        return res.steps.length && !playable
          ? `<div class="ref-line"><span class="ref-moves"><span class="muted">What can happen:</span> ${line}</span>${btns}</div>${bookBlock}`
          : `${playable ? '' : bookBlock}<div class="ref-line">${btns}</div>`;
      })()}
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

  // ---------------- "Line complete" window ----------------
  const doneDlg = $('.line-done');
  function closeDone() { clearTimeout(doneTimer); if (doneDlg.open) doneDlg.close(); }
  let doneTimer = 0;
  function showDone({ icon, title, sub, stats = '', extra = '', actions }) {
    doneDlg.querySelector('.ld-icon').textContent = icon;
    doneDlg.querySelector('.ld-title').textContent = title;
    doneDlg.querySelector('.ld-sub').textContent = sub;
    doneDlg.querySelector('.ld-stats').innerHTML = stats;
    doneDlg.querySelector('.ld-extra').innerHTML = extra;
    doneDlg.querySelector('.ld-actions').innerHTML = actions.map(([act, label, primary]) =>
      `<button class="btn${primary ? ' primary' : ''}" type="button" data-done="${act}">${label}</button>`).join('');
    doneDlg.classList.toggle('perfect', ['🎉', '🎓', '🏆'].includes(icon));
    // let the last move finish animating before the window pops up
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => {
      if (!alive || phase !== 'done' || doneDlg.open) return;
      doneDlg.showModal();
      doneDlg.querySelector('.btn.primary')?.focus();
    }, 650);
  }
  doneDlg.addEventListener('click', (e) => {
    if (e.target === doneDlg) { closeDone(); return; } // click on the backdrop
    const b = e.target.closest('[data-done]');
    if (!b) return;
    e.stopPropagation();
    closeDone();
    switch (b.dataset.done) {
      case 'next': start(lines[posOf(lineIdx) % lines.length].idx); break;
      case 'again': start(lineIdx); break;
      case 'practice': mode = 'practice'; start(lineIdx); break;
      case 'practiceall': mode = 'practice'; start(pickLine(opening, -1, level, mode)); break;
      case 'playon': $('[data-act="playon"]').click(); break;
      case 'home': location.hash = '#/'; break;
    }
  });

  /** Shown once, when the last line of the opening at this level has been learned. */
  function showAllLearned() {
    const p = openingProgress(opening, level);
    const pct = Math.round(p.value * 100);
    setStatus(`🏆 All ${p.total} lines learned! Keep practising to reach 100%.`, 'good');
    showDone({
      icon: '🏆',
      title: 'All lines learned!',
      sub: `Congratulations, you've learned every line of the ${opening.name} at ${LEVELS[level].name} level. Keep practising them from memory to reach 100%.`,
      stats: `<div><b>${p.total} / ${p.total}</b><span>lines learned</span></div>
        <div><b>${pct}%</b><span>progress</span></div>`,
      extra: progressBar(p, { label: false }),
      actions: [['home', '← Openings'], ['practiceall', 'Keep practising', true]],
    });
  }

  function complete() {
    phase = 'done';
    busy = false;
    if (mode === 'practice') {
      const wasLocked = !quizUnlocked(opening);
      const s = recordLine(opening.id, lineIdx, mistakes);
      const justUnlocked = wasLocked && quizUnlocked(opening);
      updateProgressBar($('.trainer-progress .pbar'), openingProgress(opening));
      renderLineList();
      lineInfoEl.textContent = `Line ${posOf(lineIdx)}/${lines.length}: ${entry(lineIdx).name} · ${LEVELS[level].name}, ${Math.ceil(moves.length / 2)} moves` +
        ` · practised ${s.attempts}× · strength ${s.box}/5`;
      setStatus(mistakes === 0
        ? `🎉 Line complete with no mistakes! (strength ${s.box}/5)`
        : `Line complete with ${mistakes} mistake${mistakes > 1 ? 's' : ''}. It will come back sooner for review.`,
        mistakes === 0 ? 'good' : '');
      if (justUnlocked) {
        $('.status').insertAdjacentHTML('beforeend',
          `<div class="unlock">🧩 Quiz unlocked! <a href="#/quiz/${opening.id}">Test yourself now →</a></div>`);
      }
      const stars = '★'.repeat(s.box) + `<span class="off">${'★'.repeat(Math.max(0, 5 - s.box))}</span>`;
      showDone({
        icon: mistakes === 0 ? '🎉' : '✅',
        title: mistakes === 0 ? 'Line complete!' : 'Line done',
        sub: mistakes === 0
          ? `You played ${entry(lineIdx).name} without a single mistake.`
          : `You finished ${entry(lineIdx).name} with ${mistakes} mistake${mistakes > 1 ? 's' : ''}. It will come back sooner for review.`,
        stats: `<div><b>${mistakes}</b><span>mistake${mistakes === 1 ? '' : 's'}</span></div>
          <div><b>${Math.ceil(moves.length / 2)}</b><span>moves</span></div>
          <div><b class="ld-stars" title="Strength ${s.box}/5">${stars}</b><span>strength</span></div>`,
        extra: justUnlocked ? `<div class="unlock">🧩 Quiz unlocked! <a href="#/quiz/${opening.id}">Test yourself now →</a></div>` : '',
        actions: mistakes === 0
          ? [['again', '↺ Again'], ['playon', '▶ Play on'], ['next', 'Next line →', true]]
          : [['next', 'Next line →'], ['playon', '▶ Play on'], ['again', '↺ Try again', true]],
      });
    } else {
      const first = !unlocked();
      recordLearned(opening.id, lineIdx, level);
      lineInfoEl.textContent = lineInfoEl.textContent.replace(/ · new( from move \d+)?, .*$/, ' · learned');
      renderLineList();
      setStatus(first ? '🎓 Line learned! Practice is now unlocked.' : '🎓 End of the line! Switch to Practice to test yourself.', 'good');
      if (first && lines.every((x) => lineUnlocked(opening.id, x.idx, level))) showAllLearned();
      else showDone({
        icon: '🎓',
        title: first ? 'Line learned!' : 'End of the line!',
        sub: `You've seen every move of ${entry(lineIdx).name}. ${first ? 'Practice is unlocked: test yourself from memory.' : 'Now test yourself in Practice mode.'}`,
        actions: [['again', '↺ Replay'], ['next', 'Next line →'], ['practice', 'Practice it', true]],
      });
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
    if (b.dataset.mode === 'practice' && !unlocked()) {
      setStatus('🔒 Practice is locked. Play this line to the end in <b>Learn</b> first.', 'bad');
      return;
    }
    if (b.dataset.mode) { mode = b.dataset.mode; start(lineIdx); return; }
    switch (b.dataset.act) {
      case 'hint': {
        const ply = chess.history().length;
        if (tries === 0) mistakes++;
        tries = Math.max(tries, 1);
        showHint(moves[ply]);
        setStatus('Hint: move the highlighted piece.');
        break;
      }
      case 'restart': start(lineIdx, true); break;
      case 'next': start(lines[posOf(lineIdx) % lines.length].idx); break;
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
  $('.line-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-line]');
    if (b) start(Number(b.dataset.line));
  });
  $('.line-current').addEventListener('click', () => openLines(true));
  $('.lines-close').addEventListener('click', () => openLines(false));
  $('.lines-backdrop').addEventListener('click', () => openLines(false));
  const toggle = $('.evaltoggle');
  toggle.checked = settings.evalBar;
  toggle.addEventListener('change', () => { setSetting('evalBar', toggle.checked); evaluate(); });
  const ctoggle = $('.coachtoggle');
  ctoggle.checked = coachOn();
  ctoggle.addEventListener('change', () => { setSetting('coach', ctoggle.checked); coachRender(); });

  const firstLine = Number(query.line);
  const levelSel = $('.levelsel');
  levelSel.value = level;
  levelSel.addEventListener('change', () => {
    level = levelSel.value;
    setLevel(level);
    lines = linesFor(opening, level);
    updateProgressBar($('.trainer-progress .pbar'), openingProgress(opening));
    start(entry(lineIdx) ? lineIdx : pickLine(opening, -1, level, mode));
  });

  start(query.line !== undefined && query.line !== '' && entry(firstLine) ? firstLine : pickLine(opening, -1, level, mode));

  return () => { alive = false; closeDone(); coachToken++; timers.forEach(clearTimeout); analyser.cancel(); phase = 'gone'; };
}
