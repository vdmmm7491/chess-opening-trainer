// "Since you started training": how your Chess.com results changed after your first trainer session.
import { OPENINGS, lineMoves } from './openings.js';
import { lineStats } from './progress.js';

const DAY = 86400000;
const MIN_BUCKET = 3; // fewer games than this in a period: no point on the chart (too noisy)
const TRAINED_PLIES = 4; // a game "is in" a trained line if it follows it for this many half-moves

const score = (gs) => gs.length ? gs.reduce((a, g) => a + (g.result === 'W' ? 1 : g.result === 'D' ? 0.5 : 0), 0) / gs.length : null;
const wdl = (gs) => ({ n: gs.length, W: gs.filter((g) => g.result === 'W').length, D: gs.filter((g) => g.result === 'D').length, L: gs.filter((g) => g.result === 'L').length, score: score(gs) });

/** Lines (moves) you've practised at least once, per colour. */
function trainedLines() {
  const out = { w: [], b: [] };
  for (const o of OPENINGS) o.lines.forEach((l, i) => { if (lineStats(o.id, i)?.attempts) out[o.side].push(lineMoves(l)); });
  return out;
}

/** True if the game followed a line you've practised for its first few moves. */
export function trainedMatcher() {
  const lines = trainedLines();
  return (g) => lines[g.color].some((mv) => {
    const need = Math.min(TRAINED_PLIES, mv.length);
    for (let i = 0; i < need; i++) if (mv[i] !== g.sans[i]) return false;
    return true;
  });
}

/**
 * Which trainer opening a game was played in: the one whose line it follows furthest (at least
 * 4 half-moves, your colour). Null if none, or if two openings tie (1.e4 e5 2.Nf3 Nc6 3.Nc3 could be
 * the Italian, the Ruy or the Scotch).
 */
export function openingOf(g) {
  let best = 0, hit = null, tie = false;
  for (const o of OPENINGS) {
    if (o.side !== g.color) continue;
    let d = 0;
    for (const l of o.lines) {
      const mv = lineMoves(l);
      let i = 0;
      while (i < mv.length && i < g.sans.length && mv[i] === g.sans[i]) i++;
      d = Math.max(d, i);
    }
    if (d > best) { best = d; hit = o; tie = false; }
    else if (d === best && d > 0) tie = true;
  }
  return best >= TRAINED_PLIES && !tie ? hit : null;
}

/** Calendar bucket start for a time: Monday of the week, every other Monday, or the 1st of the month. */
function bucketStart(t, size) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (size === 'month') { d.setDate(1); return d.getTime(); }
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (size === '2week') {
    const weeks = Math.floor((d.getTime() + 3 * DAY) / (7 * DAY)); // weeks since the Monday before 1 Jan 1970
    if (weeks % 2) d.setDate(d.getDate() - 7);
  }
  return d.getTime();
}
function bucketEnd(start, size) {
  const d = new Date(start);
  if (size === 'month') d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + (size === '2week' ? 14 : 7));
  return d.getTime();
}

/**
 * @param games parsed Chess.com games (any order)
 * @param started ms of your first trainer session (progress.startedLearning()), or null
 * @param {object} [opts] split: false skips the "openings you trained" series (when games are already one opening)
 * @returns {{ size, buckets: [{start, end, all, trained}], before, after, beforeTrained, afterTrained, rating }}
 *   all/trained are wdl() summaries ({n, W, D, L, score}); score is null when a bucket is too small.
 */
export function improvement(games, started, { split = true } = {}) {
  const sorted = [...games].sort((a, b) => a.end - b.end);
  const isTrained = split ? trainedMatcher() : () => false;
  const span = sorted.length ? sorted[sorted.length - 1].end - sorted[0].end : 0;
  const size = span <= 12 * 7 * DAY ? 'week' : span <= 7 * 30 * DAY ? '2week' : 'month';

  const map = new Map();
  for (const g of sorted) {
    const k = bucketStart(g.end, size);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(g);
  }
  const buckets = [...map.entries()].map(([start, gs]) => {
    const all = wdl(gs), trained = wdl(gs.filter(isTrained));
    if (all.n < MIN_BUCKET) all.score = null;
    if (trained.n < MIN_BUCKET) trained.score = null;
    return { start, end: bucketEnd(start, size), all, trained };
  });

  const before = started ? sorted.filter((g) => g.end < started) : [];
  const after = started ? sorted.filter((g) => g.end >= started) : sorted;

  // Rating change in the time control you play most: last game before you started → your latest game.
  const counts = new Map();
  for (const g of sorted) counts.set(g.timeClass, (counts.get(g.timeClass) || 0) + 1);
  const tc = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const inTc = sorted.filter((g) => g.timeClass === tc && Number.isFinite(g.myRating));
  let rating = null;
  if (started && inTc.length) {
    const from = inTc.filter((g) => g.end < started).pop() || null;
    const to = inTc[inTc.length - 1];
    if (from && to.end >= started) rating = { timeClass: tc, from: from.myRating, to: to.myRating };
  }

  return {
    size, buckets,
    before: wdl(before), after: wdl(after),
    beforeTrained: wdl(before.filter(isTrained)), afterTrained: wdl(after.filter(isTrained)),
    rating,
  };
}
