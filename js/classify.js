// Move classification (brilliant / great / best / ... / blunder) and the badges that show it.
// Symbols are the standard chess annotation marks; colours and icons are our own.
import { Chess } from './ui.js';

const BOOK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 3.2C3.6 2.4 5.6 2.3 7.3 3v10c-1.7-.7-3.7-.6-5.3.2zm12 0c-1.6-.8-3.6-.9-5.3-.2v10c1.7-.7 3.7-.6 5.3.2z"/></svg>';

/** All classes, best first. `code` is a one-letter id used in URLs. */
export const CLASSES = {
  brilliant:  { code: 'r', label: 'Brilliant',  symbol: '!!', color: '#9b5de5', desc: 'A sound sacrifice: the best move, and it gives up material.' },
  great:      { code: 'g', label: 'Great',      symbol: '!',  color: '#3a86ff', desc: 'The only move that keeps the position: every other move is clearly worse.' },
  best:       { code: 's', label: 'Best',       symbol: '★',  color: '#2a9d8f', desc: "Stockfish's top choice, or within 0.3 pawns of it." },
  good:       { code: 'o', label: 'Good',       symbol: '✓',  color: '#6a994e', desc: 'Close to the best move.' },
  book:       { code: 'k', label: 'Book',       symbol: BOOK_ICON, color: '#7d8597', desc: "A move from the trainer's repertoire." },
  inaccuracy: { code: 'i', label: 'Inaccuracy', symbol: '?!', color: '#e9a23b', desc: 'Loses a little (1.2–2.2 pawns).' },
  mistake:    { code: 'm', label: 'Mistake',    symbol: '?',  color: '#e76f24', desc: 'Loses a lot (2.2–3.5 pawns).' },
  blunder:    { code: 'b', label: 'Blunder',    symbol: '??', color: '#d62839', desc: 'Loses more than 3.5 pawns.' },
};
const BY_CODE = Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [v.code, k]));

/** Round badge for a class key. `extra` adds CSS classes (e.g. 'on-board'). */
export function badgeHtml(key, extra = '') {
  const c = CLASSES[key];
  if (!c) return '';
  return `<span class="mbadge ${extra}" style="--mb:${c.color}" title="${c.label}" aria-label="${c.label}">${c.symbol}</span>`;
}

/** Encode/decode a per-ply list of class keys (null = unclassified) as a compact string for URLs. */
export const encodeClasses = (keys) => keys.map((k) => (k && CLASSES[k] ? CLASSES[k].code : '-')).join('');
export const decodeClasses = (s) => [...(s || '')].map((ch) => BY_CODE[ch] || null);

// Thresholds in centipawns lost compared with the engine's best move.
export const LOSS = { good: 30, inaccuracy: 120, mistake: 220, blunder: 350 };
const TOP = 15; // within this of the best move counts as playing the best move

/** Expected score (0..1) for the side to move, from a centipawn evaluation. */
export const winProb = (cp) => 1 / (1 + Math.exp(-0.00368 * cp));

/**
 * Classify one move. Scores are centipawns from the mover's point of view.
 * @param {{bestScore:number, playedScore:number, secondScore?:number|null, sacrifice?:boolean,
 *          deepConfirmed?:boolean, recapture?:boolean}} s
 */
export function classify(s) {
  const loss = s.bestScore - s.playedScore;
  if (loss >= LOSS.blunder) return 'blunder';
  if (loss >= LOSS.mistake) return 'mistake';
  if (loss >= LOSS.inaccuracy) return 'inaccuracy';
  if (loss > TOP) return loss >= LOSS.good ? 'good' : 'best';
  // You played the best move (or as good as). Was it special?
  if (s.sacrifice && s.deepConfirmed && s.playedScore >= -100) return 'brilliant';
  if (isOnlyMove(s)) return 'great';
  return 'best';
}

/**
 * Great = the only move that keeps the position: the position after it is at least holding
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
