// Move classification and the badges that show it. The names, colours and badge design are our
// own; the symbols are the traditional chess annotation marks (!!, !, ?!, ?, ??), which nobody owns.
import { Chess } from './ui.js';

const BOOK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 3.2C3.6 2.4 5.6 2.3 7.3 3v10c-1.7-.7-3.7-.6-5.3.2zm12 0c-1.6-.8-3.6-.9-5.3-.2v10c1.7-.7 3.7-.6 5.3.2z"/></svg>';
const TARGET_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/></svg>';

/** All classes, best first. `fg` is the symbol colour (white if not set). */
export const CLASSES = {
  masterstroke: { label: 'Masterstroke', symbol: '!!', color: 'linear-gradient(135deg,#ffd76a,#e0a106)', fg: '#3a2900', desc: 'A sound sacrifice: the best move, and it gives up material.' },
  only:         { label: 'Only move',    symbol: '!',  color: '#7c4dff', desc: 'The only move that keeps the position: every other move is clearly worse.' },
  top:          { label: 'Top move',     symbol: TARGET_ICON, color: '#1f8a70', desc: "Stockfish's choice, or practically as good." },
  solid:        { label: 'Solid',        symbol: '✓',  color: '#5b8a3c', desc: 'A good move, just slightly less accurate than the best one.' },
  theory:       { label: 'Theory',       symbol: BOOK_ICON, color: '#64748b', desc: "A move from the trainer's repertoire." },
  dubious:      { label: 'Dubious',      symbol: '?!', color: '#f08c00', desc: 'Gives away some of your chances (in a level position, roughly 1–2 pawns).' },
  mistake:      { label: 'Mistake',      symbol: '?',  color: '#e0531f', desc: 'Gives away a lot (in a level position, roughly 2–3.5 pawns).' },
  blunder:      { label: 'Blunder',      symbol: '??', color: '#c62828', desc: 'Throws the position away: a big swing towards your opponent.' },
};
export const POSITIVE = ['masterstroke', 'only'];
export const NEGATIVE = ['dubious', 'mistake', 'blunder'];

/** "Key to the move labels": every badge with what it means. Open by default when `open` is true. */
export function legendHtml(open = false) {
  return `<details class="class-key"${open ? ' open' : ''}><summary>Key to the move labels</summary>
    <ul>${Object.entries(CLASSES).map(([k, c]) => `<li>${badgeHtml(k, 'lg')}<span><b>${c.label}</b> ${c.desc}</span></li>`).join('')}</ul>
  </details>`;
}

/** Badge for a class key. `extra` adds CSS classes (e.g. 'lg'). */
export function badgeHtml(key, extra = '') {
  const c = CLASSES[key];
  if (!c) return '';
  return `<span class="mbadge ${extra}" style="--mb:${c.color};--mb-fg:${c.fg || '#fff'}" title="${c.label}" aria-label="${c.label}">${c.symbol}</span>`;
}

/** Expected score (0..1) for the side to move, from a centipawn evaluation. */
export const winProb = (cp) => 1 / (1 + Math.exp(-0.00368 * cp));

// Thresholds on the expected score you give away compared with the engine's best move. Using
// expected score rather than raw pawns means dropping from +12 to +8 in a won position isn't a
// "blunder", while dropping from +1 to -1 is. In a level position the steps are about 0.3, 1.2,
// 2.2 and 3.5 pawns.
export const DROP = { top: 0.03, dubious: 0.1, mistake: 0.18, blunder: 0.28 };

/** Expected score lost by playing `playedScore` instead of `bestScore` (centipawns, mover's view). */
export const drop = (bestScore, playedScore) => Math.max(0, winProb(bestScore) - winProb(playedScore));

/**
 * Classify one move. Scores are centipawns from the mover's point of view.
 * @param {{bestScore:number, playedScore:number, secondScore?:number|null, sacrifice?:boolean,
 *          deepConfirmed?:boolean, recapture?:boolean}} s
 */
export function classify(s) {
  const d = drop(s.bestScore, s.playedScore);
  if (d >= DROP.blunder) return 'blunder';
  if (d >= DROP.mistake) return 'mistake';
  if (d >= DROP.dubious) return 'dubious';
  if (d >= DROP.top) return 'solid';
  // You played the best move (or as good as). Was it special?
  if (s.sacrifice && s.deepConfirmed && s.playedScore >= -100) return 'masterstroke';
  if (isOnlyMove(s)) return 'only';
  return 'top';
}

/**
 * Only move = the only move that keeps the position: the position after it is at least holding
 * (>= 40% expected score) and the second-best move throws away 20%+ of the expected score.
 * Obvious recaptures don't count.
 */
export function isOnlyMove({ bestScore, secondScore, recapture }) {
  if (secondScore == null || recapture) return false;
  const wb = winProb(bestScore);
  return wb >= 0.4 && wb - winProb(secondScore) >= 0.2;
}

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Does this move leave the moved piece where the opponent can win it (2+ pawns of material net)?
 * A two-ply exchange check: opponent captures on the destination, we recapture if we can.
 */
export function isSacrifice(fen, uci) {
  const c = new Chess(fen);
  let mv;
  try { mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return false; }
  if (mv.piece === 'k') return false;
  const moved = VALUE[mv.promotion || mv.piece];
  const gained = mv.captured ? VALUE[mv.captured] : 0;
  let worst = 0;
  for (const r of c.moves({ verbose: true })) {
    if (r.to !== mv.to) continue;
    c.move(r);
    const canRecapture = c.moves({ verbose: true }).some((x) => x.to === mv.to);
    c.undo();
    worst = Math.max(worst, moved - gained - (canRecapture ? VALUE[r.piece] : 0));
  }
  return worst >= 2;
}

/**
 * Accuracy of one move (0–100) from the expected score it gave away (`drop`, 0..1): 100 for the
 * engine's move, about 65 for a move that loses 10%, about 30 for one that loses 25%.
 */
export const moveAccuracy = (d) => Math.max(0, Math.min(100, 103.17 * Math.exp(-4.354 * (d || 0)) - 3.17));

/**
 * Accuracy over a set of rated moves (engineCheck() entries): the average of the arithmetic and the
 * harmonic mean of the per-move accuracies, so a single blunder pulls the score down noticeably.
 * @returns {number|null} 0–100, or null when there are no moves.
 */
export function accuracy(moves) {
  const a = moves.map((m) => moveAccuracy(m.drop));
  if (!a.length) return null;
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const harmonic = a.length / a.reduce((s, x) => s + 1 / Math.max(1, x), 0);
  return (mean + harmonic) / 2;
}

/** Text colour class for an accuracy figure. */
export const accuracyClass = (acc) => (acc == null ? 'muted' : acc >= 85 ? 'good' : acc < 65 ? 'bad' : '');
