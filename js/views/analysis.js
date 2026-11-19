import { getEngine } from '../engine.js';
import { Board } from '../board.js';
import { getSettings } from '../progress.js';import { h, esc, Chess, EvalBar, destsFn, checkSquare, lastMoveOf, renderMoveList, makeAnalyser, findBook } from '../ui.js';

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

  const view = h(`<div class="play-layout">
    <div><div class="board-wrap"><div class="board"></div></div></div>
    <aside class="side">
      <div class="card">
        <h1 style="margin:0 0 6px">Analysis board</h1>
        <div class="muted book" style="font-size:.9rem;min-height:1.3em"></div>
      </div>
      <div class="card">
        <div class="engine-line"></div>
        <label class="toggle" style="margin-top:8px"><input type="checkbox" class="arrow" checked> Show best move arrow</label>
      </div>
      <div class="card">
        <div class="movelist"></div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn small" data-act="first">⏮</button>
          <button class="btn small" data-act="back">◀</button>
          <button class="btn small" data-act="fwd">▶</button>
          <button class="btn small" data-act="last">⏭</button>
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

  function rebuild() {
    chess = new Chess(startFen);
    for (const s of sans.slice(0, cursor)) chess.move(s);
  }

  function sync() {
    board.getDests = destsFn(chess);
    board.setFen(chess.fen(), lastMoveOf(chess), checkSquare(chess));
    renderMoveList($('.movelist'), sans, (i) => { cursor = i + 1; rebuild(); sync(); }, cursor - 1);
    bar.setOrientation(board.orientation);
    bar.setVisible(getSettings().evalBar !== false);
    const showArrow = $('.arrow').checked && !enginePlays;
    board.setArrows([]);
    analyser.run(chess.fen(), { depth: 18, showArrow });
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

  rebuild();
  sync();
  return () => { window.removeEventListener('keydown', onKey); analyser.cancel(); enginePlays = null; };
}
