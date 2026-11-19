import { getOpening, lineMoves } from '../openings.js';
import { recordLine, pickLine, lineStats, getSettings, setSetting } from '../progress.js';
import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser } from '../ui.js';

export function render(root, { id, query }) {
  const opening = getOpening(id);
  if (!opening) { root.appendChild(h('<p>Opening not found. <a href="#/">Back</a></p>')); return; }

  let mode = query.mode === 'learn' ? 'learn' : 'practice';
  let fixedLine = query.line !== undefined && query.line !== '' ? Number(query.line) : null;
  const userColor = opening.side;
  const settings = getSettings();
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
  const bar = new EvalBar();
  $('.board-wrap').prepend(bar.el);

  let chess = new Chess();
  let lineIdx = 0, moves = [], mistakes = 0, tries = 0, phase = 'book', busy = false;
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

  function sync() {
    board.getDests = destsFn(chess);
    board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
    renderMoveList(moveListEl, chess.history());
    // Learn mode: always show the move to play.
    const ply = chess.history().length;
    if (phase === 'book' && mode === 'learn' && chess.turn() === userColor && moves[ply]) showArrow(moves[ply]);
    else board.setArrows([]);
    evaluate();
    updateButtons();
  }

  function evaluate() {
    bar.setVisible(settings.evalBar);
    bar.setOrientation(board.orientation);
    // Hide the engine's best line while practising so it can't spoil the answer.
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
    view.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    view.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('primary', b.dataset.mode === mode));
    $('[data-act="hint"]').disabled = phase !== 'book' || chess.turn() !== userColor;
    $('[data-act="playon"]').disabled = phase !== 'done';
  }

  function start(idx) {
    timers.forEach(clearTimeout); timers.clear();
    lineIdx = idx;
    moves = lineMoves(opening.lines[idx]);
    chess = new Chess();
    mistakes = 0; tries = 0; phase = 'book'; busy = false;
    $('.line-select').value = fixedLine === null ? '' : String(fixedLine);
    const st = lineStats(opening.id, idx);
    lineInfoEl.textContent = `Line ${idx + 1}/${opening.lines.length}: ${opening.lines[idx].name}` +
      (st ? ` · practised ${st.attempts}× · level ${st.box}/5` : ' · new');
    sync();
    if (userColor === 'b') { busy = true; setStatus('Watch White\'s move…'); later(opponentMove, 500); }
    else promptUser();
  }

  function promptUser() {
    const ply = chess.history().length;
    if (mode === 'learn') setStatus(`Play <b>${esc(moves[ply])}</b> (shown with the arrow).`);
    else setStatus(`Your move. What's the book move here?`);
  }

  function siblingLine(sanHistory, san) {
    // Another line of this opening that shares the history so far and continues with `san`.
    for (let i = 0; i < opening.lines.length; i++) {
      if (i === lineIdx) continue;
      const mv = lineMoves(opening.lines[i]);
      if (mv.length > sanHistory.length && sanHistory.every((s, k) => mv[k] === s) && mv[sanHistory.length] === san) return i;
    }
    return -1;
  }

  function userMove(from, to, promo) {
    let m;
    try { m = chess.move({ from, to, promotion: promo || 'q' }); } catch { return sync(); }

    if (phase === 'free') { sync(); if (!chess.isGameOver()) engineReply(); else gameOverStatus(); return; }

    const hist = chess.history();
    const ply = hist.length - 1;
    const expected = moves[ply];
    if (m.san !== expected) {
      const sib = fixedLine === null ? siblingLine(hist.slice(0, -1), m.san) : -1;
      if (sib >= 0) {
        lineIdx = sib; moves = lineMoves(opening.lines[sib]);
        lineInfoEl.textContent = `Line ${sib + 1}/${opening.lines.length}: ${opening.lines[sib].name}`;
      } else {
        chess.undo();
        if (tries === 0) mistakes++;
        tries++;
        board.flash();
        sync();
        if (tries >= 2 || mode === 'learn') {
          showArrow(expected);
          setStatus(`✗ ${esc(m.san)} isn't the book move. Play <b>${esc(expected)}</b>.`, 'bad');
        } else {
          setStatus(`✗ ${esc(m.san)} isn't in your repertoire here. Try again.`, 'bad');
        }
        return;
      }
    }
    tries = 0;
    sync();
    setStatus(`✓ ${esc(m.san)} – correct!`, 'good');
    if (chess.history().length >= moves.length) return complete();
    busy = true;
    later(opponentMove, 450);
  }

  function opponentMove() {
    busy = false;
    const ply = chess.history().length;
    chess.move(moves[ply]);
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
    setStatus(chess.isCheckmate() ? (chess.turn() === userColor ? 'Checkmate – Stockfish wins.' : 'Checkmate – you win! 🏆') : 'Draw.');
  }

  view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) { mode = b.dataset.mode; start(lineIdx); return; }
    switch (b.dataset.act) {
      case 'hint': {
        const ply = chess.history().length;
        if (tries === 0) mistakes++;
        tries = Math.max(tries, 1);
        showArrow(moves[ply]);
        setStatus(`Hint: play <b>${esc(moves[ply])}</b>.`);
        break;
      }
      case 'restart': start(lineIdx); break;
      case 'next': start(fixedLine !== null ? fixedLine : pickLine(opening, lineIdx)); break;
      case 'playon':
        phase = 'free';
        setStatus('Free play against Stockfish – the book is over, keep going!');
        sync();
        if (chess.turn() !== userColor) engineReply();
        break;
      case 'analyse': location.hash = `#/analysis?fen=${encodeURIComponent(chess.fen())}`; break;
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

  start(fixedLine !== null ? fixedLine : pickLine(opening));

  return () => { timers.forEach(clearTimeout); analyser.cancel(); phase = 'gone'; };
}
