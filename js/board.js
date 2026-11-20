// Lightweight, dependency-free chessboard.
// - Left button / touch: tap-to-move or drag-and-drop (pointer events)
// - Right-click drag: draw arrows; right-click a square: highlight it (Shift/Ctrl/Alt = other colours)
// - Left-click anywhere clears drawn arrows and highlights
// - setFen() animates the change: pieces slide (castling moves both king and rook), captured pieces
//   fade out, a promoted pawn turns into its new piece, check pulses the king, checkmate topples it.
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm';
import { pieceSet, animationsOn } from './theme.js';

// Piece SVGs are shipped with the site (assets/pieces/<set>/), copied from lichess (see LICENSE.md there).
// Loading them from a CDN was unreliable: pieces sometimes failed to appear.
const PIECE_BASE = 'assets/pieces/';
const FILES = 'abcdefgh';

// Arrow / highlight palette
export const ARROW_COLORS = { orange: '#f39c12', green: '#3fae6a', red: '#e5484d', blue: '#3b8cf0' };
const MARK_COLORS = { orange: '#f5a524', green: '#4cbf78', red: '#e85d61', blue: '#4f9af2' };

export function pieceUrl(color, type, set = pieceSet()) {
  return `${PIECE_BASE}${set}/${color}${type.toUpperCase()}.svg`;
}

function preload() {
  for (const c of 'wb') for (const t of 'pnbrqk') { const i = new Image(); i.src = pieceUrl(c, t); }
}
preload();
window.addEventListener('pieceset', preload);

function parseFen(fen) {
  const map = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      map[FILES[f] + (8 - r)] = { color, type: ch.toLowerCase() };
      f++;
    }
  });
  return map;
}

/** Pair up the pieces that left a square with the ones that arrived, so they can slide. */
function diffPieces(before, after, lastMove) {
  const same = (a, b) => a && b && a.color === b.color && a.type === b.type;
  const gone = [], came = [];
  for (const sq of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[sq], after[sq])) continue;
    if (before[sq]) gone.push(sq);
    if (after[sq]) came.push(sq);
  }
  const moves = [], usedFrom = new Set(), usedTo = new Set();
  const dist = (a, b) => Math.hypot(FILES.indexOf(a[0]) - FILES.indexOf(b[0]), a[1] - b[1]);
  // The move that was just played first: this also pairs a pawn with the piece it promoted to.
  if (lastMove && gone.includes(lastMove.from) && came.includes(lastMove.to) && before[lastMove.from].color === after[lastMove.to].color) {
    moves.push({ from: lastMove.from, to: lastMove.to, promo: before[lastMove.from].type !== after[lastMove.to].type });
    usedFrom.add(lastMove.from); usedTo.add(lastMove.to);
  }
  for (const to of came) {
    if (usedTo.has(to)) continue;
    const cands = gone.filter((f) => !usedFrom.has(f) && same(before[f], after[to])).sort((a, b) => dist(a, to) - dist(b, to));
    if (cands[0]) { moves.push({ from: cands[0], to }); usedFrom.add(cands[0]); usedTo.add(to); }
  }
  return {
    moves,
    captured: gone.filter((sq) => !usedFrom.has(sq)), // removed, or taken by the piece that landed there
    appeared: came.filter((sq) => !usedTo.has(sq)),   // e.g. a captured piece coming back when you step backwards
  };
}

function modifierColor(e) {
  if (e.shiftKey) return 'green';
  if (e.ctrlKey || e.metaKey) return 'red';
  if (e.altKey) return 'blue';
  return 'orange';
}

export class Board {
  /**
   * @param {HTMLElement} el
   * @param {{orientation?:'w'|'b', getDests?:(sq:string)=>string[], onMove?:(from:string,to:string,promo?:string)=>void, canMove?:(color:string)=>boolean}} opts
   */
  constructor(el, opts = {}) {
    this.el = el;
    this.el.classList.add('board');
    this.orientation = opts.orientation || 'w';
    this.getDests = opts.getDests || (() => []);
    this.onMove = opts.onMove || (() => {});
    this.canMove = opts.canMove || (() => true);
    this.pieces = {};
    this.lastMove = null;
    this.checkSq = null;
    this.selected = null;
    this.arrows = [];      // arrows set by the app (hints, engine)
    this.userArrows = [];  // arrows drawn by the user
    this.marks = {};       // square -> colour key, drawn by the user
    this.badge = null;     // {sq, html}: a move-classification badge in a square's corner
    this.preview = null;   // arrow being drawn
    this.drag = null;
    this.rdrag = null;
    this.timers = new Set(); // pending animation steps
    this.build();
    this.bind();
  }

  build() {
    this.el.innerHTML = '';
    this.squares = {};
    for (let i = 0; i < 64; i++) {
      const row = Math.floor(i / 8), col = i % 8;
      const file = this.orientation === 'w' ? col : 7 - col;
      const rank = this.orientation === 'w' ? 8 - row : row + 1;
      const sq = FILES[file] + rank;
      const div = document.createElement('div');
      div.className = 'sq ' + ((file + rank) % 2 === 1 ? 'l' : 'd');
      div.dataset.sq = sq;
      if (row === 7) div.insertAdjacentHTML('beforeend', `<span class="coord file">${FILES[file]}</span>`);
      if (col === 0) div.insertAdjacentHTML('beforeend', `<span class="coord rank">${rank}</span>`);
      this.el.appendChild(div);
      this.squares[sq] = div;
    }
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'arrows');
    this.svg.setAttribute('viewBox', '0 0 8 8');
    this.el.appendChild(this.svg);
    this.renderPieces();
    this.renderHighlights();
    this.renderMarks();
    this.renderBadge();
    this.renderArrows();
  }

  /** Show `html` in the top-right corner of `sq` (null clears it). */
  setBadge(sq, html) { this.badge = sq && html ? { sq, html } : null; this.renderBadge(); }

  renderBadge() {
    this.el.querySelector('.sq-badge')?.remove();
    if (!this.badge) return;
    const b = document.createElement('div');
    b.className = 'sq-badge';
    b.innerHTML = this.badge.html;
    this.squares[this.badge.sq]?.appendChild(b);
  }

  setFen(fen, lastMove = null, checkSq = null) {
    const before = this.pieces;
    const prevCheck = this.checkSq, prevMate = this.mateSq;
    this.pieces = parseFen(fen);
    this.lastMove = lastMove;
    this.checkSq = checkSq;
    this.mateSq = null;
    if (checkSq) { try { if (new Chess(fen).isCheckmate()) this.mateSq = checkSq; } catch { /* partial FEN */ } }
    this.selected = null;
    this.stopAnimations(); // a new position cuts any running animation short: only the latest one plays
    const skip = this.skipAnim;
    this.skipAnim = null;
    this.renderPieces();
    this.renderHighlights();
    if (!animationsOn()) return;
    const d = diffPieces(before, this.pieces, lastMove);
    // Jumping far through a game (⏮ / ⏭) changes most of the board: just show the new position.
    if (d.moves.length + d.captured.length + d.appeared.length > 10) return;
    this.animate(d, before, skip);
    const king = (sq) => this.squares[sq].querySelector('.piece:not(.ghost)');
    if (this.mateSq && this.mateSq !== prevMate) {
      this.pulse(this.mateSq, 'anim-mate', 150);
      king(this.mateSq)?.animate([{ rotate: '0deg', translate: '0 0' }, { rotate: '-80deg', translate: '-4% 10%' }],
        { duration: 650, delay: 350, easing: 'cubic-bezier(.5,-0.4,.7,1.4)', fill: 'backwards' });
    } else if (checkSq && checkSq !== prevCheck) {
      this.pulse(checkSq, 'anim-check', 120);
      king(checkSq)?.animate([{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '8deg' }, { rotate: '-5deg' }, { rotate: '3deg' }, { rotate: '0deg' }],
        { duration: 450, delay: 150, easing: 'ease-in-out' });
    }
  }

  /** setTimeout that stopAnimations() can cancel. */
  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  /** Jump every running animation to its end: drop leftover captured pieces, effects and pending steps. */
  stopAnimations() {
    this.animGen = (this.animGen || 0) + 1; // callbacks of cut-short animations see a stale number and do nothing
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.el.querySelectorAll('.ghost, .sq-fx').forEach((x) => x.remove());
    for (const a of this.el.getAnimations({ subtree: true })) if (!(a instanceof CSSAnimation)) a.finish();
  }

  /** Square offset (in squares, on screen) from `to` back to `from`. */
  offset(from, to) {
    const [x1, y1] = this.sqCenter(from), [x2, y2] = this.sqCenter(to);
    return [x1 - x2, y1 - y2];
  }

  animate({ moves, captured, appeared }, before, skip) {
    const pieceEl = (sq) => this.squares[sq].querySelector('.piece:not(.ghost)');
    const gen = this.animGen;
    for (const m of moves) {
      const el = pieceEl(m.to);
      if (!el) continue;
      if (skip && skip.from === m.from && skip.to === m.to) { if (m.promo) this.pulse(m.to, 'anim-promo'); continue; }
      const [dx, dy] = this.offset(m.from, m.to);
      const ms = Math.min(320, 160 + 35 * Math.hypot(dx, dy));
      el.classList.add('moving');
      const a = el.animate([{ transform: `translate(${dx * 100}%, ${dy * 100}%)` }, { transform: 'translate(0, 0)' }],
        { duration: ms, easing: 'cubic-bezier(.25,.8,.35,1)' });
      a.onfinish = a.oncancel = () => {
        el.classList.remove('moving');
        if (m.promo && gen === this.animGen) this.pulse(m.to, 'anim-promo');
      };
      if (m.promo) {
        // Slide the pawn, then swap it for the new piece.
        const img = el.style.backgroundImage;
        const p = before[m.from];
        el.style.backgroundImage = `url(${pieceUrl(p.color, p.type)})`;
        this.later(() => { if (el.isConnected) el.style.backgroundImage = img; }, ms);
      }
    }
    // A captured piece just fades out while the capturing piece slides in (no shrink, spin or burst).
    for (const sq of captured) {
      const by = moves.find((m) => m.to === sq);
      if (!by) continue;
      const p = before[sq];
      const ghost = document.createElement('div');
      ghost.className = 'piece ghost';
      ghost.style.backgroundImage = `url(${pieceUrl(p.color, p.type)})`;
      this.squares[sq].appendChild(ghost);
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).onfinish = () => ghost.remove();
      this.later(() => ghost.remove(), 450);
    }
    for (const sq of appeared) {
      pieceEl(sq)?.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    }
  }

  /** One-off effect on a square (check, promotion glow, checkmate). */
  pulse(sq, cls, delay = 0) {
    const run = () => {
      const fx = document.createElement('div');
      fx.className = 'sq-fx ' + cls;
      this.squares[sq]?.appendChild(fx);
      this.later(() => fx.remove(), 1200);
    };
    if (delay) this.later(run, delay); else run();
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.build();
  }

  flip() { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); }

  /** App-controlled arrows: [{from, to, color?: 'green'|'blue'|'orange'|'red'|css}] */
  setArrows(arrows) { this.arrows = arrows || []; this.renderArrows(); }

  clearDrawings() {
    if (!this.userArrows.length && !Object.keys(this.marks).length) return;
    this.userArrows = [];
    this.marks = {};
    this.renderMarks();
    this.renderArrows();
  }

  flash() {
    const f = document.createElement('div');
    f.className = 'flash';
    this.el.appendChild(f);
    setTimeout(() => f.remove(), 500);
  }

  renderPieces() {
    for (const div of Object.values(this.squares)) div.querySelectorAll('.piece').forEach((x) => x.remove());
    for (const [sq, p] of Object.entries(this.pieces)) {
      const d = document.createElement('div');
      d.className = 'piece';
      d.style.backgroundImage = `url(${pieceUrl(p.color, p.type)})`;
      this.squares[sq].appendChild(d);
    }
  }

  renderHighlights() {
    const dests = this.selected ? this.getDests(this.selected) : [];
    for (const [sq, div] of Object.entries(this.squares)) {
      div.classList.toggle('last', !!this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq));
      div.classList.toggle('sel', this.selected === sq);
      div.classList.toggle('check', this.checkSq === sq);
      div.classList.toggle('mated', this.mateSq === sq);
      const isDest = dests.includes(sq);
      div.classList.toggle('dot', isDest && !this.pieces[sq]);
      div.classList.toggle('cap', isDest && !!this.pieces[sq]);
    }
  }

  renderMarks() {
    for (const [sq, div] of Object.entries(this.squares)) {
      div.querySelector('.mark')?.remove();
      const c = this.marks[sq];
      if (c) {
        const m = document.createElement('div');
        m.className = 'mark';
        m.style.background = MARK_COLORS[c] || c;
        div.appendChild(m);
      }
    }
  }

  sqCenter(sq) {
    const f = FILES.indexOf(sq[0]), r = Number(sq[1]);
    const x = this.orientation === 'w' ? f : 7 - f;
    const y = this.orientation === 'w' ? 8 - r : r - 1;
    return [x + 0.5, y + 0.5];
  }

  /** Build the SVG for one arrow. Knight moves get an L-shaped arrow. */
  arrowSvg(a, opacity = 0.8) {
    const color = ARROW_COLORS[a.color] || a.color || ARROW_COLORS.green;
    const [x1, y1] = this.sqCenter(a.from);
    const [x2, y2] = this.sqCenter(a.to);
    const dx = x2 - x1, dy = y2 - y1;
    const W = 0.2, HW = 0.52, HL = 0.42; // shaft width, head width, head length (in squares)
    const knight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
    const pts = knight
      ? [[x1, y1], Math.abs(dx) > Math.abs(dy) ? [x2, y1] : [x1, y2], [x2, y2]]
      : [[x1, y1], [x2, y2]];
    // Start a little away from the centre of the origin square, like big chess sites do.
    const [sx, sy] = pts[0], [nx0, ny0] = pts[1];
    const l0 = Math.hypot(nx0 - sx, ny0 - sy);
    const startOff = knight ? 0 : 0.25;
    pts[0] = [sx + ((nx0 - sx) / l0) * startOff, sy + ((ny0 - sy) / l0) * startOff];
    // Head: tip slightly past the centre of the target square.
    const [px, py] = pts[pts.length - 2];
    const len = Math.hypot(x2 - px, y2 - py);
    const ux = (x2 - px) / len, uy = (y2 - py) / len;
    const tip = [x2 + ux * 0.1, y2 + uy * 0.1];
    const base = [tip[0] - ux * HL, tip[1] - uy * HL];
    const nx = -uy, ny = ux;
    const shaft = [...pts.slice(0, -1), base].map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
    const head = [tip, [base[0] + nx * HW / 2, base[1] + ny * HW / 2], [base[0] - nx * HW / 2, base[1] - ny * HW / 2]]
      .map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
    // Grouping with a single opacity avoids darker overlaps where shaft and head meet.
    return `<g opacity="${opacity}"><path d="${shaft}" fill="none" stroke="${color}" stroke-width="${W}" stroke-linejoin="miter" stroke-linecap="butt"/>` +
      `<polygon points="${head}" fill="${color}"/></g>`;
  }

  renderArrows() {
    const all = [
      ...this.arrows.map((a) => this.arrowSvg(a, 0.75)),
      ...this.userArrows.map((a) => this.arrowSvg(a, 0.8)),
      ...(this.preview ? [this.arrowSvg(this.preview, 0.6)] : []),
    ];
    this.svg.innerHTML = all.join('');
  }

  squareAt(clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    const col = Math.floor(((clientX - r.left) / r.width) * 8);
    const row = Math.floor(((clientY - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = this.orientation === 'w' ? col : 7 - col;
    const rank = this.orientation === 'w' ? 8 - row : row + 1;
    return FILES[file] + rank;
  }

  movable(sq) {
    const p = this.pieces[sq];
    return p && this.canMove(p.color) && this.getDests(sq).length > 0;
  }

  bind() {
    const handlers = {
      move: (e) => this.moveDrag(e),
      up: (e) => this.up(e),
      cancel: () => this.cancelDrag(),
      pieces: () => this.renderPieces(),
    };
    // Window listeners outlive the board when the page changes, so they remove themselves.
    const guard = (fn) => (e) => {
      if (!this.el.isConnected) {
        window.removeEventListener('pointermove', h.move);
        window.removeEventListener('pointerup', h.up);
        window.removeEventListener('pointercancel', h.cancel);
        window.removeEventListener('pieceset', h.pieces);
        return;
      }
      fn(e);
    };
    const h = Object.fromEntries(Object.entries(handlers).map(([k, fn]) => [k, guard(fn)]));
    this.el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', h.move);
    window.addEventListener('pointerup', h.up);
    window.addEventListener('pointercancel', h.cancel);
    window.addEventListener('pieceset', h.pieces);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(e) {
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    e.preventDefault();

    if (e.button === 2) {
      this.cancelDrag();
      this.rdrag = { from: sq, to: sq, color: modifierColor(e) };
      return;
    }
    if (e.button !== undefined && e.button !== 0) return;
    this.clearDrawings();

    if (this.selected && this.selected !== sq && this.getDests(this.selected).includes(sq)) {
      this.tryMove(this.selected, sq);
      return;
    }
    if (this.movable(sq)) {
      const wasSelected = this.selected === sq;
      this.selected = sq;
      this.renderHighlights();
      const pieceEl = this.squares[sq].querySelector('.piece');
      this.drag = { from: sq, el: pieceEl, startX: e.clientX, startY: e.clientY, moved: false, wasSelected };
    } else {
      this.selected = null;
      this.renderHighlights();
    }
  }

  moveDrag(e) {
    if (this.rdrag) {
      const sq = this.squareAt(e.clientX, e.clientY);
      if (sq !== this.rdrag.to) {
        this.rdrag.to = sq;
        this.preview = sq && sq !== this.rdrag.from ? { from: this.rdrag.from, to: sq, color: this.rdrag.color } : null;
        this.renderArrows();
      }
      return;
    }
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startX, dy = e.clientY - this.drag.startY;
    if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
    this.drag.moved = true;
    if (this.drag.el) {
      this.drag.el.classList.add('dragging');
      this.drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  up(e) {
    if (this.rdrag && e.button === 2) {
      const { from, color } = this.rdrag;
      const to = this.squareAt(e.clientX, e.clientY);
      this.rdrag = null;
      this.preview = null;
      if (!to || to === from) {
        if (this.marks[from] === color) delete this.marks[from]; else this.marks[from] = color;
        this.renderMarks();
      } else {
        const i = this.userArrows.findIndex((a) => a.from === from && a.to === to);
        if (i >= 0 && this.userArrows[i].color === color) this.userArrows.splice(i, 1);
        else if (i >= 0) this.userArrows[i].color = color;
        else this.userArrows.push({ from, to, color });
      }
      this.renderArrows();
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.el) { d.el.classList.remove('dragging'); d.el.style.transform = ''; }
    const sq = this.squareAt(e.clientX, e.clientY);
    if (d.moved) {
      // The piece was dragged there already: don't slide it in from its old square.
      if (sq && sq !== d.from && this.getDests(d.from).includes(sq)) { this.skipAnim = { from: d.from, to: sq }; this.tryMove(d.from, sq); }
    } else if (d.wasSelected && sq === d.from) {
      // tapping a selected piece again deselects it
      this.selected = null;
      this.renderHighlights();
    }
  }

  cancelDrag() {
    if (this.rdrag) { this.rdrag = null; this.preview = null; this.renderArrows(); }
    if (!this.drag) return;
    if (this.drag.el) { this.drag.el.classList.remove('dragging'); this.drag.el.style.transform = ''; }
    this.drag = null;
  }

  tryMove(from, to) {
    const p = this.pieces[from];
    this.selected = null;
    if (p && p.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      this.askPromotion(p.color).then((promo) => {
        if (promo) this.onMove(from, to, promo); else this.renderHighlights();
      });
      return;
    }
    this.onMove(from, to);
  }

  askPromotion(color) {
    return new Promise((resolve) => {
      const box = document.createElement('div');
      box.className = 'promo';
      for (const t of ['q', 'r', 'b', 'n']) {
        const b = document.createElement('button');
        b.style.backgroundImage = `url(${pieceUrl(color, t)})`;
        b.setAttribute('aria-label', t);
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); box.remove(); resolve(t); });
        box.appendChild(b);
      }
      box.addEventListener('pointerdown', (e) => { if (e.target === box) { e.stopPropagation(); box.remove(); resolve(null); } });
      this.el.appendChild(box);
    });
  }
}
