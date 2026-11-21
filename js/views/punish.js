// Punish mistakes: the board shows a position right after a common opponent mistake
// in this opening; find the move (or short sequence) that punishes it.
import { getOpening } from '../openings.js';
import { PUNISH, BANDS, bandFor, inBand } from '../punish.js';
import { recordPunish, punishStats, getSettings, setSetting } from '../progress.js';
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
        <p class="muted" style="margin:8px 0 0;font-size:.9rem">${esc(opening.name)}: mistakes ${esc(them)} often makes, sorted by rating. Pick your rating to see the ones your opponents actually play.
          The board shows the position right after the mistake. Find the move that punishes it.</p>
        <div class="btn-row" style="margin-top:10px">
          <a class="btn small" href="#/train/${opening.id}?mode=learn">Learn</a>
          <a class="btn small" href="#/train/${opening.id}?mode=practice">Practice</a>
        </div>
      </div>
      <div class="card status-card">
        <div class="quiz-head"><b>⚔️ ${esc(opening.name)}</b><span class="tag ${userColor}">${userColor === 'w' ? 'White' : 'Black'}</span></div>
        <div class="punish-pickers">
          <select class="input punish-band" aria-label="Opponent rating"></select>
          <select class="input punish-select" aria-label="Mistake"></select>
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
  let idx = 0, setup = [], sol = [], step = 0, tries = 0, hints = 0, busy = false, done = false, clean = true, token = 0;
  const board = new Board($('.board'), {
    orientation: userColor,
    getDests: destsFn(chess),
    canMove: (color) => !busy && !done && color === userColor && chess.turn() === userColor,
    onMove: (from, to, promo) => userMove(from, to, promo),
  });

  function setStatus(html, cls = '') { const s = $('.status'); s.className = 'status ' + cls; s.innerHTML = html; }

  // ---- Rating band: show the mistakes players at your level actually make ----
  const bandSelect = $('.punish-band');
  const countIn = (min) => list.filter((e) => inBand(e, min)).length;
  const bandsWithEntries = BANDS.filter((b) => countIn(b.min));
  bandSelect.innerHTML = `<option value="all">All ratings (${list.length})</option>` +
    BANDS.map((b) => `<option value="${b.min}"${countIn(b.min) ? '' : ' disabled'}>${b.label} (${countIn(b.min)})</option>`).join('');
  /** Closest band that has mistakes for this opening. */
  const nearest = (min) => bandsWithEntries.reduce((a, b) => (Math.abs(b.min - min) < Math.abs(a.min - min) ? b : a)).min;
  const settings = getSettings();
  let wanted = settings.punishBand ?? (settings.rating ? bandFor(settings.rating) : 'all');
  let band = 'all';
  let visible = [];

  function setBand(value, remember = true) {
    const note = $('.punish-note');
    note.textContent = '';
    if (value === 'all' || value === undefined) band = 'all';
    else {
      const min = Number(value);
      band = countIn(min) ? min : nearest(min);
      if (band !== min) {
        const want = BANDS.find((b) => b.min === min), got = BANDS.find((b) => b.min === band);
        note.textContent = `No ${opening.name} mistakes for ${want.label} yet, so here are the ${got.label} ones.`;
      }
    }
    if (remember) setSetting('punishBand', value);
    bandSelect.value = String(band);
    visible = list.map((_, i) => i).filter((i) => band === 'all' || inBand(list[i], band));
  }

  function fillSelect() {
    const stats = punishStats(opening.id);
    select.innerHTML = visible.map((i, n) =>
      `<option value="${i}">${stats[list[i].name] ? '✓ ' : ''}${n + 1}. ${esc(list[i].name)}</option>`).join('');
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

  const mistakeLabel = () => `${moveNo(setup.length - 1, setup[setup.length - 1])}?`;

  function start(i) {
    token++;
    idx = visible.includes(i) ? i : visible[0];
    const e = list[idx];
    setup = split(e.moves);
    sol = split(e.punish);
    step = 0; tries = 0; hints = 0; busy = false; done = false; clean = true;
    chess = new Chess();
    setup.forEach((s) => chess.move(s));
    fillSelect();
    const last = lastMoveOf(chess);
    sync(last ? [{ ...last, color: 'red' }] : []);
    setStatus(`${esc(them)} played <b class="bad">${esc(mistakeLabel())}</b> Find the punishment!`);
    coachBody.innerHTML = `<div class="coach-entry mistake">
      <div class="coach-title">What's wrong with <b>${esc(mistakeLabel())}</b></div>
      <p class="coach-idea">${esc(e.mistake)}</p></div>`;
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
      if (tries >= 2) {
        showArrow(expected);
        setStatus(`✗ ${esc(m.san)} lets ${esc(them)} off the hook. Play <b>${esc(expected)}</b> (arrow).`, 'bad');
      } else {
        setStatus(`✗ ${esc(m.san)} isn't the punishment. Try again!`, 'bad');
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
    hints++;
    clean = false;
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
  bandSelect.addEventListener('change', () => { setBand(bandSelect.value); start(visible[0]); });

  const first = Number(query.n);
  setBand(wanted, false);
  start(Number.isInteger(first) && visible.includes(first) ? first : visible[0]);
  return () => { token++; };
}
