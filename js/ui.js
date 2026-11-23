// Shared UI helpers: eval bar, chess helpers, small DOM utilities.
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/+esm';
import { formatEval } from './engine.js';
import { OPENINGS, lineMoves } from './openings.js';

export { Chess };

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Opening progress bar from openingProgress(): light layer = lines played,
 * solid layer = overall progress. Returns an HTML string.
 */
export function progressBar(p, { label = true } = {}) {
  const pct = Math.round(p.value * 100);
  const playedPct = p.total ? (p.played / p.total) * 100 : 0;
  const tip = `${p.played}/${p.total} lines played · ${p.learned} learned (strength 3+) · ${pct}% overall`;
  return `<div class="pbar" title="${tip}">
    ${label ? `<div class="pbar-text"><span>${p.played}/${p.total} lines played${p.learned ? ` · ${p.learned} learned` : ''}</span><b class="pbar-pct">${pct}%</b></div>` : ''}
    <div class="bar progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${tip}">
      <span class="played" style="width:${playedPct}%"></span><span class="fill" style="width:${pct}%"></span></div>
  </div>`;
}

/** Update a progressBar() element in place so its widths animate. */
export function updateProgressBar(el, p) {
  const fresh = h(progressBar(p, { label: !!el.querySelector('.pbar-text') }));
  const oldPct = Number(el.querySelector('[role=progressbar]').getAttribute('aria-valuenow'));
  el.title = fresh.title;
  const t = el.querySelector('.pbar-text');
  if (t) t.innerHTML = fresh.querySelector('.pbar-text').innerHTML;
  const bar = el.querySelector('[role=progressbar]'), nb = fresh.querySelector('[role=progressbar]');
  ['aria-valuenow', 'aria-label'].forEach((a) => bar.setAttribute(a, nb.getAttribute(a)));
  bar.querySelector('.played').style.width = nb.querySelector('.played').style.width;
  bar.querySelector('.fill').style.width = nb.querySelector('.fill').style.width;
  const gain = Math.round(p.value * 100) - oldPct;
  if (gain) {
    const pctEl = el.querySelector('.pbar-pct');
    pctEl?.insertAdjacentHTML('beforebegin', `<span class="pbar-gain ${gain > 0 ? 'up' : 'down'}">${gain > 0 ? '+' : ''}${gain}%</span>`);
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  }
}

/** Vertical evaluation bar. */
export class EvalBar {
  constructor() {
    this.el = h(`<div class="evalbar" title="Stockfish evaluation">
      <div class="white"></div><span class="label top"></span><span class="label bottom"></span></div>`);
    this.fill = this.el.querySelector('.white');
    this.top = this.el.querySelector('.label.top');
    this.bottom = this.el.querySelector('.label.bottom');
    this.set(null);
  }
  setOrientation(color) { this.el.classList.toggle('flipped', color === 'b'); }
  setVisible(v) { this.el.classList.toggle('hidden', !v); }
  set(info) {
    let pct = 50;
    if (info) {
      if (info.mate !== undefined) pct = info.mate > 0 ? 100 : 0;
      else pct = 50 + 50 * (2 / (1 + Math.exp(-0.004 * info.cp)) - 1);
    }
    pct = Math.max(2, Math.min(98, pct));
    if (info?.mate === 0) pct = info.whiteCp > 0 ? 100 : 0;
    this.fill.style.height = pct + '%';
    const txt = info ? formatEval(info).replace('+', '') : '';
    const whiteAhead = !info || info.whiteCp >= 0;
    this.bottom.textContent = whiteAhead ? txt : '';
    this.top.textContent = whiteAhead ? '' : txt.replace('-', '');
  }
}

/** Legal destination squares for a square, as a function bound to a chess instance. */
export function destsFn(chess) {
  return (sq) => chess.moves({ square: sq, verbose: true }).map((m) => m.to);
}

export function checkSquare(chess) {
  if (!chess.inCheck()) return null;
  const turn = chess.turn();
  for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square;
  return null;
}

export function lastMoveOf(chess) {
  const hist = chess.history({ verbose: true });
  const m = hist[hist.length - 1];
  return m ? { from: m.from, to: m.to } : null;
}

/** Convert a UCI PV into SAN text starting from fen. */
export function pvToSan(fen, pv, max = 8) {
  const c = new Chess(fen);
  const out = [];
  let num = Number(fen.split(' ')[5]) || 1;
  for (const uci of pv.slice(0, max)) {
    try {
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (m.color === 'w') out.push(`${num}. ${m.san}`);
      else { out.push(out.length === 0 ? `${num}... ${m.san}` : m.san); num++; }
    } catch { break; }
  }
  return out.join(' ');
}

/** `badges[i]` (optional) is HTML shown after move i, e.g. a classification badge. */
export function renderMoveList(el, sans, onClick, current = sans.length - 1, badges = []) {
  el.innerHTML = '';
  sans.forEach((san, i) => {
    if (i % 2 === 0) el.appendChild(h(`<span class="num">${i / 2 + 1}.</span>`));
    const s = h(`<span class="mv${i === current ? ' cur' : ''}">${esc(san)}${badges[i] || ''}</span>`);
    if (onClick) s.addEventListener('click', () => onClick(i));
    el.appendChild(s);
  });
  el.scrollTop = el.scrollHeight;
}

/** Find the deepest book line in our repertoire that matches a SAN history. */
export function findBook(sans) {
  let best = null;
  for (const o of OPENINGS) {
    o.lines.forEach((line, idx) => {
      const mv = lineMoves(line);
      let n = 0;
      while (n < sans.length && n < mv.length && mv[n] === sans[n]) n++;
      if (n > 0 && (!best || n > best.depth)) best = { opening: o, lineIdx: idx, line, depth: n, inBook: n === sans.length };
    });
  }
  return best;
}

/** Wire an eval bar + engine-line element to an engine for a given position. */
export function makeAnalyser(engine, bar, lineEl, board) {
  let token = 0;
  return {
    async run(fen, { depth = 15, showArrow = false } = {}) {
      const my = ++token;
      const c = new Chess(fen);
      if (c.isGameOver()) {
        engine.stop();
        if (c.isCheckmate()) bar.set({ mate: 0, whiteCp: c.turn() === 'w' ? -10000 : 10000 });
        else bar.set({ cp: 0, whiteCp: 0 });
        if (lineEl) lineEl.textContent = c.isCheckmate() ? 'Checkmate' : 'Draw';
        if (board && showArrow) board.setArrows([]);
        return null;
      }
      const res = await engine.analyse(fen, {
        depth,
        onInfo: (info) => {
          if (my !== token) return;
          bar.set(info);
          if (lineEl) lineEl.textContent = `${formatEval(info)}  d${info.depth}  ${pvToSan(fen, info.pv, 8)}`;
          // Shallow iterations jump between moves; only draw the arrow once the search has settled a bit.
          if (board && showArrow && info.pv[0] && info.depth >= Math.min(10, depth)) {
            board.setArrows([{ from: info.pv[0].slice(0, 2), to: info.pv[0].slice(2, 4), color: 'blue' }]);
          }
        },
      });
      return my === token ? res : null;
    },
    cancel() { token++; engine.stop(); },
  };
}
