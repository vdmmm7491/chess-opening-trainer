// Punish mistakes: the board shows a position right after a common opponent mistake
// in this opening; find the move (or short sequence) that punishes it. Mistakes are picked
// for your training level and the line you choose, and nothing on screen names the
// mistake or the answer until you've solved it (the hint ladder reveals it step by step).
import { getOpening, LEVELS, LEVEL_KEYS, linesFor } from '../openings.js';
import { PUNISH, forLevel, linesOf } from '../punish.js';
import { recordPunish, punishStats, getLevel, setLevel } from '../progress.js';
import { Board } from '../board.js';
import { h, esc, Chess, destsFn, checkSquare, lastMoveOf, renderMoveList } from '../ui.js';

const moveNo = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'}${san}`;
const split = (s) => s.trim().split(/\s+/);
const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function render(root, { id, query }) {
  const opening = getOpening(id);
  const list = PUNISH[id] || [];
  if (!opening || !list.length) {
    root.appendChild(h('<p>No mistakes to punish for this opening yet. <a href="#/">Back</a></p>'));
    return;
  }
  const userColor = opening.side;
  const them = userColor === 'w' ? 'Black' : 'White';

  const view = h(`<div class="play-layout quiz-view punish-view">
    <div><div class="board-wrap"><div class="board"></div></div></div>
    <aside class="side">
      <div class="card quiz-intro">
        <div class="kv" style="align-items:center"><h1 style="margin:0">⚔️ Punish mistakes</h1>
          <span class="tag ${userColor}">You play ${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <p class="muted" style="margin:8px 0 0;font-size:.9rem">${esc(opening.name)}: natural-looking moves ${esc(them)} plays at your level, in the lines you train.
          The board shows the position right after one of them. Something in it doesn't work: find the move that proves it.</p>
        <div class="btn-row" style="margin-top:10px">
          <a class="btn small" href="#/train/${opening.id}?mode=learn">Learn</a>
          <a class="btn small" href="#/train/${opening.id}?mode=practice">Practice</a>
        </div>
      </div>
      <div class="card status-card">
        <div class="quiz-head"><b>⚔️ ${esc(opening.name)}</b><span class="tag ${userColor}">${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <div class="punish-pickers">
          <select class="input punish-level" aria-label="Training level">${LEVEL_KEYS.map((k) => `<option value="${k}">${esc(LEVELS[k].name)} (${esc(LEVELS[k].range)})</option>`).join('')}</select>
          <select class="input punish-line" aria-label="Line"></select>
          <select class="input punish-select" aria-label="Position"></select>
        </div>
        <div class="punish-note muted"></div>
        <div class="status"></div>
        <div class="movelist" style="margin-top:6px"></div>
      </div>
      <div class="card coach">
        <div class="coach-head"><span class="coach-avatar">🎓</span><b>Coach</b></div>
        <div class="coach-body"></div>
      </div>
      <nav class="card btn-row quiz-actions" aria-label="Punish actions">
        <button class="btn small primary" data-act="next">Next mistake →</button>
        <button class="btn small" data-act="hint">💡 Hint</button>
        <button class="btn small" data-act="retry">↺ Retry</button>
        <button class="btn small" data-act="flip">⇅ Flip</button>
        <a class="btn small quiz-tab" href="#/train/${opening.id}?mode=learn">📖 Learn</a>
        <a class="btn small quiz-tab" href="#/train/${opening.id}?mode=practice">🎯 Practice</a>
      </nav>
    </aside>
  </div>`);
  root.appendChild(view);
  const $ = (s) => view.querySelector(s);
  const coachBody = $('.coach-body');
  const select = $('.punish-select');

  let chess = new Chess();
  let idx = 0, setup = [], sol = [], step = 0, tries = 0, hints = 0, busy = false, done = false, clean = true, token = 0, told = false;
  const board = new Board($('.board'), {
    orientation: userColor,
    getDests: destsFn(chess),
    canMove: (color) => !busy && !done && color === userColor && chess.turn() === userColor,
    onMove: (from, to, promo) => userMove(from, to, promo),
  });

  function setStatus(html, cls = '') { const s = $('.status'); s.className = 'status ' + cls; s.innerHTML = html; }

  // ---- Level and line: show the mistakes your opponents make in the lines you train ----
  const levelSel = $('.punish-level'), lineSel = $('.punish-line');
  const entryLines = list.map((e) => linesOf(opening, e));
  // Easier mistakes first, then data order.
  const order = list.map((_, i) => i).sort((a, b) => list[a].elo - list[b].elo || a - b);
  const pick = (lvl, line) => order.filter((i) => forLevel(list[i], lvl) && (line === 'all' || entryLines[i].includes(line)));
  /** Levels by distance from `lvl` (itself first, then the one below, the one above, ...). */
  const byDistance = (lvl) => {
    const k = LEVEL_KEYS.indexOf(lvl);
    return [...LEVEL_KEYS].sort((a, b) => Math.abs(LEVEL_KEYS.indexOf(a) - k) - Math.abs(LEVEL_KEYS.indexOf(b) - k) ||
      LEVEL_KEYS.indexOf(a) - LEVEL_KEYS.indexOf(b));
  };
  let level = getLevel(), line = 'all', visible = [];

  function fillLines() {
    const lines = linesFor(opening, level);
    const n = (idx) => pick(level, idx).length;
    lineSel.innerHTML = `<option value="all">All lines (${pick(level, 'all').length})</option>` +
      lines.map((x) => `<option value="${x.idx}"${n(x.idx) ? '' : ' disabled'}>${esc(x.name)} (${n(x.idx)})</option>`).join('');
    if (line !== 'all' && !lines.some((x) => x.idx === line)) line = 'all';
    lineSel.value = String(line);
  }

  /** Visible mistakes for the chosen level and line; falls back to the nearest level, then all lines. */
  function choose() {
    const note = $('.punish-note');
    note.textContent = '';
    const lineName = line === 'all' ? null : opening.lines[line].name;
    for (const [lvl, ln] of [...byDistance(level).map((l) => [l, line]), ...(line === 'all' ? [] : byDistance(level).map((l) => [l, 'all']))]) {
      visible = pick(lvl, ln);
      if (!visible.length) continue;
      if (lvl !== level || ln !== line) {
        const want = LEVELS[level].name, got = LEVELS[lvl].name;
        note.textContent = ln === line
          ? `No ${want} mistakes ${lineName ? `in the ${lineName}` : 'for this opening'} yet, so here are the ${got} ones.`
          : lvl === level
            ? `No ${want} mistakes in the ${lineName} yet, so here are the ones from other lines.`
            : `No mistakes in the ${lineName} yet, so here are ${got} ones from other lines.`;
      }
      return;
    }
  }

  function fillSelect() {
    const stats = punishStats(opening.id);
    select.innerHTML = visible.map((i, n) => {
      const e = list[i], mv = split(e.moves), solved = stats[e.name];
      // Unsolved: just the move, no "?" and no name. The name gives the idea away.
      return `<option value="${i}">${solved ? '✓ ' : ''}${n + 1}. ${solved ? esc(e.name) : `after ${esc(moveNo(mv.length - 1, mv[mv.length - 1]))}`}</option>`;
    }).join('');
    select.value = String(idx);
  }

  function sync(arrows = []) {
    board.getDests = destsFn(chess);
    board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
    board.setArrows(arrows);
    board.setHints?.([]);
    renderMoveList($('.movelist'), chess.history());
    $('.movelist').scrollLeft = $('.movelist').scrollWidth; // phones: one-row strip, newest move visible
  }

  const lastLabel = () => moveNo(setup.length - 1, setup[setup.length - 1]);
  const mistakeLabel = () => `${lastLabel()}?`;
  const PROMPT = `<div class="coach-entry">
      <div class="coach-title">Your move</div>
      <p class="coach-idea">This move looks normal, but it doesn't work. What did it stop guarding? What did it walk into?
        Checks, captures and threats first. Stuck? 💡 Hint explains what went wrong.</p></div>`;
  function revealMistake() {
    coachBody.innerHTML = `<div class="coach-entry mistake">
      <div class="coach-title">What's wrong with <b>${esc(mistakeLabel())}</b></div>
      <p class="coach-idea">${esc(list[idx].mistake)}</p></div>`;
  }

  function start(i) {
    token++;
    idx = visible.includes(i) ? i : visible[0];
    const e = list[idx];
    setup = split(e.moves);
    sol = split(e.punish);
    step = 0; tries = 0; hints = 0; busy = false; done = false; clean = true; told = false;
    chess = new Chess();
    setup.forEach((s) => chess.move(s));
    fillSelect();
    sync();
    setStatus(`${esc(them)} played <b>${esc(lastLabel())}</b>. Punish it!`);
    coachBody.innerHTML = PROMPT;
    $('[data-act="hint"]').disabled = false;
  }

  function userMove(from, to, promo) {
    let m;
    try { m = chess.move({ from, to, promotion: promo || 'q' }); } catch { return sync(); }
    const expected = sol[step];
    // Any mate also counts: there's nothing more to punish.
    if (m.san !== expected && !chess.isCheckmate()) {
      chess.undo();
      tries++;
      clean = false;
      board.flash();
      sync();
      // Ladder: 1st miss explains the mistake, 2nd shows the piece, 3rd the move.
      if (tries >= 3) {
        showArrow(expected);
        setStatus(`✗ ${esc(m.san)} lets ${esc(them)} off the hook. Play <b>${esc(expected)}</b> (arrow).`, 'bad');
      } else if (tries === 2) {
        const p = new Chess(chess.fen()).move(expected);
        board.setHints?.([p.from]);
        setStatus(`✗ ${esc(m.san)} isn't it. Use your <b>${PIECE[p.piece]}</b> (highlighted).`, 'bad');
      } else {
        if (step === 0 && !told) { told = true; revealMistake(); }
        setStatus(`✗ ${esc(m.san)} isn't the punishment. ${step === 0 ? 'Read the coach and try again!' : 'Try again!'}`, 'bad');
      }
      return;
    }
    step++;
    tries = 0; hints = 0;
    sync();
    if (step >= sol.length || chess.isCheckmate()) return finish();
    setStatus(`✓ ${esc(m.san)}!`, 'good');
    busy = true;
    $('[data-act="hint"]').disabled = true;
    const my = token;
    setTimeout(() => {
      if (my !== token || !view.isConnected) return;
      const r = chess.move(sol[step]);
      step++;
      busy = false;
      sync();
      $('[data-act="hint"]').disabled = false;
      setStatus(`✓ Good! ${esc(them)} answers <b>${esc(r.san)}</b>. Keep going: what's next?`, 'good');
    }, 650);
  }

  function showArrow(san) {
    const m = new Chess(chess.fen()).move(san);
    board.setArrows([{ from: m.from, to: m.to }]);
  }

  function hint() {
    if (busy || done) return;
    const m = new Chess(chess.fen()).move(sol[step]);
    clean = false;
    // First hint on the first move: explain what's wrong with their move, nothing more.
    if (step === 0 && !told) {
      told = true;
      revealMistake();
      setStatus('Hint: read what the coach says about their move.');
      return;
    }
    hints++;
    tries = Math.max(tries, 1);
    if (hints === 1) {
      board.setArrows([]);
      board.setHints?.([m.from]);
      setStatus(`Hint: use your <b>${PIECE[m.piece]}</b> (highlighted).`);
    } else {
      board.setHints?.([]);
      showArrow(sol[step]);
      setStatus(`Play <b>${esc(m.san)}</b> (arrow).`);
      $('[data-act="hint"]').disabled = true;
    }
  }

  function finish() {
    done = true;
    const e = list[idx];
    recordPunish(opening.id, e.name, clean);
    fillSelect();
    const stats = punishStats(opening.id);
    const solved = visible.filter((i) => stats[list[i].name]).length;
    setStatus(`🎉 Punished! <span class="muted" style="font-weight:400">${solved} / ${visible.length} solved</span>`, 'good');
    const startPly = setup.length;
    const line = sol.map((s, i) => (startPly + i) % 2 === 0 || i === 0 ? moveNo(startPly + i, s) : s).join(' ');
    coachBody.innerHTML = `<div class="coach-entry you">
      <div class="coach-title">Why it works</div>
      <p class="coach-idea">${esc(e.why)}</p>
      <p class="muted" style="margin:6px 0 0;font-size:.85rem">${esc(mistakeLabel())} ${esc(line)}</p></div>`;
    $('[data-act="hint"]').disabled = true;
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'next') start(visible[(visible.indexOf(idx) + 1) % visible.length]);
    if (b.dataset.act === 'retry') { start(idx); }
    if (b.dataset.act === 'hint') hint();
    if (b.dataset.act === 'flip') board.flip();
  });
  select.addEventListener('change', () => { start(Number(select.value)); });
  levelSel.addEventListener('change', () => {
    level = levelSel.value;
    setLevel(level); // same setting as the trainer's Level picker
    fillLines(); choose(); start(visible[0]);
  });
  lineSel.addEventListener('change', () => {
    line = lineSel.value === 'all' ? 'all' : Number(lineSel.value);
    choose(); start(visible[0]);
  });

  // ?line=<index> comes from the trainer's Punish button (the line you were training).
  const qLine = Number(query.line);
  if (query.line !== undefined && query.line !== '' && opening.lines[qLine]) line = qLine;
  levelSel.value = level;
  fillLines();
  choose();
  const first = Number(query.n);
  start(Number.isInteger(first) && visible.includes(first) ? first : visible[0]);
  return () => { token++; };
}
