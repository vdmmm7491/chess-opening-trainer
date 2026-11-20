// Lightweight, dependency-free chessboard.
// - Left button / touch: tap-to-move or drag-and-drop (pointer events)
// - Right-click drag: draw arrows; right-click a square: highlight it (Shift/Ctrl/Alt = other colours)
// - Left-click anywhere clears drawn arrows and highlights
import { pieceSet } from './theme.js';

// Piece SVGs are shipped with the site (assets/pieces/<set>/), copied from lichess (see LICENSE.md there).
// Loading them from a CDN was unreliable: pieces sometimes failed to appear.
const PIECE_BASE = 'assets/pieces/';
const FILES = 'abcdefgh';

// Arrow / highlight palette (similar to what players are used to on big chess sites)
export const ARROW_COLORS = { orange: '#ffaa00', green: '#9fcf3f', red: '#f2543d', blue: '#48b4f0' };
const MARK_COLORS = { orange: '#ffaa00', green: '#acce59', red: '#eb6150', blue: '#52b0dc' };

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
    this.hints = [];       // squares the app highlights as a hint (cleared by setFen)
    this.arrows = [];      // arrows set by the app (answers, engine)
    this.userArrows = [];  // arrows drawn by the user
    this.marks = {};       // square -> colour key, drawn by the user
    this.preview = null;   // arrow being drawn
    this.drag = null;
    this.rdrag = null;
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
    this.renderArrows();
  }

  setFen(fen, lastMove = null, checkSq = null) {
    this.pieces = parseFen(fen);
    this.lastMove = lastMove;
    this.checkSq = checkSq;
    this.selected = null;
    this.hints = [];
    this.renderPieces();
    this.renderHighlights();
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.build();
  }

  flip() { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); }

  /** Hint highlight on squares, e.g. the piece that should move. Cleared by setFen. */
  setHints(squares) { this.hints = squares || []; this.renderHighlights(); }

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
    for (const div of Object.values(this.squares)) div.querySelector('.piece')?.remove();
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
      div.classList.toggle('hint', this.hints.includes(sq));
      div.classList.toggle('check', this.checkSq === sq);
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
      if (sq && sq !== d.from && this.getDests(d.from).includes(sq)) this.tryMove(d.from, sq);
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
