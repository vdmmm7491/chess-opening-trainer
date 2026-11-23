// Engine annotation of a whole famous game: every move (both sides) gets a classification badge and
// the evaluation of the position before it. Results are saved in localStorage per game, move by move,
// so a game is only analysed once per device and an interrupted run carries on where it stopped.
import { Chess, findBook } from './ui.js';
import { classifyMove } from './chesscom.js';
import { RATINGS } from './game-ratings.js';

const KEY = 'opening-trainer.famous-games.v1';
const VERSION = 4; // bump when the method changes, so old results are redone
export const ANNOTATE_DEPTH = 12;

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full / private mode */ }
}

/**
 * The saved annotation for a game, or a fresh empty one if the moves or depth changed.
 * `moves[ply]` = {k: class key, l: centipawns lost, b: engine's move (SAN), e: eval before the move, pv: best line (UCI)}
 * `final` = eval of the final position (if the game didn't end in mate/stalemate).
 */
export function savedAnnotation(id, sans) {
  // Ratings shipped with the site (made with tools/rate-games.html at a greater depth) come first.
  const shipped = RATINGS[id];
  if (shipped && shipped.key === sans.join(' ')) return { ...shipped, moves: shipped.moves.slice(), done: true };
  const rec = loadAll()[id];
  if (rec && rec.v === VERSION && rec.depth === ANNOTATE_DEPTH && rec.key === sans.join(' ') && Array.isArray(rec.moves)) return rec;
  return fresh(sans);
}
const fresh = (sans) => ({ v: VERSION, depth: ANNOTATE_DEPTH, key: sans.join(' '), moves: [], final: null, done: false });

/**
 * Annotate the moves that aren't saved yet. Calls onMove(ply, entry) after each one.
 * Rejects with 'cancelled' if another search interrupts it (the progress so far is kept).
 */
export async function annotateGame(engine, id, sans, rec, { onMove, depth = ANNOTATE_DEPTH, save = true } = {}) {
  const store = () => { if (!save) return; const all = loadAll(); all[id] = rec; saveAll(all); };
  const c = new Chess();
  let prev = null;
  for (let ply = 0; ply < sans.length; ply++) {
    const fen = c.fen();
    const mv = c.move(sans[ply]);
    const last = prev;
    prev = mv;
    if (rec.moves[ply]) continue;
    const book = findBook(sans.slice(0, ply + 1));
    const inBook = book && book.inBook && book.depth === ply + 1;
    const r = await classifyMove(engine, fen, mv, last, { depth, verify: true });
    rec.moves[ply] = r ? { k: inBook ? 'theory' : r.kind, l: r.loss, b: r.best, e: r.eval, pv: r.pv } : { k: null };
    store();
    onMove?.(ply, rec.moves[ply]);
  }
  if (!c.isGameOver() && !rec.final) {
    const r = await engine.analyse(c.fen(), { depth });
    if (r.cancelled) throw new Error('cancelled');
    const info = r.info;
    if (info) rec.final = { e: { whiteCp: info.whiteCp, depth: info.depth, ...(info.mate !== undefined ? { mate: info.mate } : { cp: info.cp }) }, pv: info.pv.slice(0, 8) };
  }
  rec.done = true;
  store();
  return rec;
}
