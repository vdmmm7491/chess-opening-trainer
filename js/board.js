// Lightweight, dependency-free chessboard with tap-to-move and drag-and-drop
// (pointer events, so it works with mouse, touch and pen).

const PIECE_BASE = 'https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/';
const FILES = 'abcdefgh';

export function pieceUrl(color, type) {
  return `${PIECE_BASE}${color}${type.toUpperCase()}.svg`;
}

// Preload piece images so the first render does not flicker.
for (const c of 'wb') for (const t of 'pnbrqk') { const i = new Image(); i.src = pieceUrl(c, t); }

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
    this.arrows = [];
    this.drag = null;
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
    this.renderArrows();
  }

  setFen(fen, lastMove = null, checkSq = null) {
    this.pieces = parseFen(fen);
    this.lastMove = lastMove;
    this.checkSq = checkSq;
    this.selected = null;
    this.renderPieces();
    this.renderHighlights();
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.build();
  }

  flip() { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); }

  setArrows(arrows) { this.arrows = arrows || []; this.renderArrows(); }

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
      div.classList.toggle('check', this.checkSq === sq);
      const isDest = dests.includes(sq);
      div.classList.toggle('dot', isDest && !this.pieces[sq]);
      div.classList.toggle('cap', isDest && !!this.pieces[sq]);
    }
  }

  sqCenter(sq) {
    const f = FILES.indexOf(sq[0]), r = Number(sq[1]);
    const x = this.orientation === 'w' ? f : 7 - f;
    const y = this.orientation === 'w' ? 8 - r : r - 1;
    return [x + 0.5, y + 0.5];
  }

  renderArrows() {
    const ns = 'http://www.w3.org/2000/svg';
    this.svg.innerHTML = '';
    const defs = document.createElementNS(ns, 'defs');
    this.svg.appendChild(defs);
    this.arrows.forEach((a, i) => {
      const color = a.color || 'rgba(21,120,27,0.8)';
      const id = 'ah' + i;
      defs.insertAdjacentHTML('beforeend',
        `<marker id="${id}" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="${color}"/></marker>`);
      const [x1, y1] = this.sqCenter(a.from);
      const [x2, y2] = this.sqCenter(a.to);
      const len = Math.hypot(x2 - x1, y2 - y1);
      const shorten = 0.35;
      const ex = x2 - ((x2 - x1) / len) * shorten, ey = y2 - ((y2 - y1) / len) * shorten;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '0.17');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('marker-end', `url(#${id})`);
      this.svg.appendChild(line);
    });
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
    this.el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveDrag(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    e.preventDefault();
    if (this.selected && this.selected !== sq && this.getDests(this.selected).includes(sq)) {
      this.tryMove(this.selected, sq);
      return;
    }
    if (this.movable(sq)) {
      const wasSelected = this.selected === sq;
      this.selected = sq;
      this.renderHighlights();
      const pieceEl = this.squares[sq].querySelector('.piece');
      const r = this.el.getBoundingClientRect();
      this.drag = { from: sq, el: pieceEl, startX: e.clientX, startY: e.clientY, size: r.width / 8, moved: false, wasSelected };
    } else {
      this.selected = null;
      this.renderHighlights();
    }
  }

  moveDrag(e) {
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
