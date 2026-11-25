// Progress tracking stored in localStorage (per device).
// Use Export / Import on the Progress page to move progress between devices, or sign in to
// cloud sync (js/cloud.js), which merges this state with the copy saved online (mergeStates).

import { LEVELS, LEVEL_KEYS, linesFor, cutMoves, getOpening } from './openings.js';

const KEY = 'opening-trainer.v1';
const DAY = 86400000;
// Spaced-repetition intervals (days) for boxes 0..5
const INTERVALS = [0, 1, 3, 7, 14, 30];

function blank() {
  return { lines: {}, days: {}, history: [], settings: { evalBar: true, chesscomUser: '' } };
}

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.lines) return { ...blank(), ...s, settings: { ...blank().settings, ...s.settings } };
  } catch { /* ignore */ }
  return blank();
}

const saveListeners = new Set();
/** Call `fn` after every save (cloud sync uploads the change). Returns an unsubscribe function. */
export function onSave(fn) { saveListeners.add(fn); return () => saveListeners.delete(fn); }

function save(notify = true) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full / private mode */ }
  if (notify) for (const fn of saveListeners) { try { fn(); } catch { /* a listener must not break saving */ } }
}

export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getSettings() { return state.settings; }
export function setSetting(k, v) { state.settings[k] = v; save(); }

// ---- Training level (Beginner / Amateur / Intermediate / Advanced) ----
// Progress is saved per level, because a line learned to move 6 is not the same as the full line,
// but it is shared when read (see "Synced levels" below).
// Advanced uses the plain `openingId:lineIndex` key, so progress saved before levels existed
// (when lines were trained in full) stays with the full lines.

/** Your training level. Unset: Advanced if you already have progress (old full lines), else Beginner. */
export function getLevel() {
  const l = state.settings.level;
  if (LEVELS[l]) return l;
  return Object.keys(state.lines).some((k) => !k.includes('@')) ? 'advanced' : 'beginner';
}
export function setLevel(l) { if (LEVELS[l]) setSetting('level', l); }

const keyOf = (openingId, lineIdx, level) =>
  level === 'advanced' ? `${openingId}:${lineIdx}` : `${openingId}:${lineIdx}@${level}`;

// ---- Synced levels ----
// A line is the same at every level, only cut shorter, so what you did at one level counts at the
// others: a cut that contains this line counts in full, a cut that is the start of it counts for
// its share of the moves.

const cutCache = new Map(); // opening id -> every line at every level: { key, str, n }
function cutsOf(openingId) {
  if (!cutCache.has(openingId)) {
    const o = getOpening(openingId);
    const out = new Map();
    o?.lines.forEach((line, i) => LEVEL_KEYS.forEach((level) => {
      const mv = cutMoves(o, line, level);
      const key = keyOf(openingId, i, level);
      out.set(key, { key, str: mv.join(' '), n: mv.length });
    }));
    cutCache.set(openingId, out);
  }
  return cutCache.get(openingId);
}

/** Saved work on other cuts that contain this line at this level. */
function related(openingId, lineIdx, level) {
  const cuts = cutsOf(openingId);
  const own = keyOf(openingId, lineIdx, level);
  const me = cuts.get(own);
  const full = [];
  if (me) for (const c of cuts.values()) {
    if (c.key === own || !(state.lines[c.key] || state.studied?.[c.key])) continue;
    if (c.str === me.str || c.str.startsWith(me.str + ' ')) full.push(c);
  }
  return { own, full };
}

/** The shorter cuts of this line at lower levels: [{ level, share of its moves, n plies }]. */
function starts(openingId, lineIdx, level) {
  const cuts = cutsOf(openingId);
  const n = (l) => cuts.get(keyOf(openingId, lineIdx, l))?.n || 0;
  const moves = (plies) => Math.ceil(plies / 2); // 11 or 12 plies are 6 of your moves
  return LEVEL_KEYS.slice(0, LEVEL_KEYS.indexOf(level)).filter((l) => n(l) < n(level))
    .map((l) => ({ level: l, n: n(l), share: moves(n(l)) / moves(n(level)) }));
}

/**
 * Practice stats of a line at a level. Work at a level that contains this line takes over when it
 * is newer and stronger, so practising deeper never lowers your progress here.
 */
export function lineStats(openingId, lineIdx, level = getLevel()) {
  const { own, full } = related(openingId, lineIdx, level);
  let best = state.lines[own] || null;
  for (const c of full) {
    const s = state.lines[c.key];
    if (s && (!best || (s.last > best.last && s.box > best.box))) best = s;
  }
  return best;
}

export function recordLine(openingId, lineIdx, mistakes, level = getLevel()) {
  const key = keyOf(openingId, lineIdx, level);
  const synced = lineStats(openingId, lineIdx, level); // carry on from the strength shown
  const s = state.lines[key] || { attempts: 0, perfect: 0, mistakes: 0, box: 0, due: 0, last: 0 };
  if (synced) s.box = synced.box;
  s.attempts++;
  s.mistakes += mistakes;
  if (mistakes === 0) { s.perfect++; s.box = Math.min(5, s.box + 1); }
  else s.box = Math.max(0, s.box - (mistakes > 1 ? 2 : 1));
  s.last = Date.now();
  s.due = Date.now() + INTERVALS[s.box] * DAY;
  state.lines[key] = s;
  const d = today();
  state.days[d] = (state.days[d] || 0) + 1;
  state.history.unshift({ t: Date.now(), id: openingId, line: lineIdx, level, mistakes });
  state.history = state.history.slice(0, 300);
  save();
  return s;
}

// ---- Learned lines: Practice unlocks for a line once you've played it through in Learn mode ----

/** Remember that this line was played to the end in Learn mode. */
export function recordLearned(openingId, lineIdx, level = getLevel()) {
  state.studied = state.studied || {};
  state.studied[keyOf(openingId, lineIdx, level)] = Date.now();
  save();
}

/**
 * Is Practice unlocked for this line at this level? Yes once it was learned at this level or at
 * one that contains it. Lines practised before the lock existed count as learned.
 */
export function lineUnlocked(openingId, lineIdx, level = getLevel()) {
  const { own, full } = related(openingId, lineIdx, level);
  return !!(state.studied?.[own] || state.lines[own] || full.length);
}

/** A line you haven't learned yet: how many plies at its start you know from a lower level (0 = none). */
export function knownPlies(openingId, lineIdx, level = getLevel()) {
  if (lineUnlocked(openingId, lineIdx, level)) return 0;
  return Math.max(0, ...starts(openingId, lineIdx, level)
    .filter((c) => lineUnlocked(openingId, lineIdx, c.level)).map((c) => c.n));
}

/** Can you practise anything in this opening yet? */
export function practiceUnlocked(opening, level = getLevel()) {
  return idxs(opening, level).some((i) => lineUnlocked(opening.id, i, level));
}

// Share of a line's progress you get for completing it once (any mistakes);
// the rest comes from its spaced-repetition level (box 0..5).
const PLAYED_CREDIT = 0.2;

const creditOf = (s) => (s?.attempts ? PLAYED_CREDIT + (1 - PLAYED_CREDIT) * (s.box / 5) : 0);

/**
 * 0..1 progress of one line: 0 unseen, 0.2 once completed, 1 at strength 5. Practising the start
 * of it at another level counts for that share of the moves.
 */
export function lineProgress(openingId, lineIdx, level = getLevel()) {
  return Math.max(creditOf(lineStats(openingId, lineIdx, level)),
    ...starts(openingId, lineIdx, level).map((c) => creditOf(lineStats(openingId, lineIdx, c.level)) * c.share));
}

/** The line indexes you train in this opening at your level. */
const idxs = (opening, level) => linesFor(opening, level).map((x) => x.idx);

/** Progress summary for an opening at your level: lines played, learned (strength 3+) and overall 0..1. */
export function openingProgress(opening, level = getLevel()) {
  const list = idxs(opening, level);
  let played = 0, learned = 0, sum = 0;
  for (const i of list) {
    const s = lineStats(opening.id, i, level);
    if (s?.attempts) played++;
    if (s?.box >= 3) learned++;
    sum += lineProgress(opening.id, i, level);
  }
  return { total: list.length, played, learned, value: list.length ? sum / list.length : 0 };
}

/** 0..1 mastery for an opening (same number the progress bars show). */
export function mastery(opening) { return openingProgress(opening).value; }

/**
 * Pick the next line to train at your level: unseen or due first, weakest first. Practice only
 * picks lines you've learned, Learn starts with the ones you haven't (if there are any).
 */
export function pickLine(opening, exclude = -1, level = getLevel(), mode = 'practice') {
  const now = Date.now();
  const all = idxs(opening, level);
  const fit = all.filter((i) => lineUnlocked(opening.id, i, level) === (mode === 'practice'));
  const scored = (fit.length ? fit : all).map((i) => {
    const s = lineStats(opening.id, i, level);
    let score;
    if (!s) score = -1000 + i; // unseen lines first, in order
    else if (s.due <= now) score = s.box * 10 + (s.due - now) / DAY;
    else score = 100 + (s.due - now) / DAY;
    return { i, score: score + (i === exclude ? 500 : 0) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.i ?? 0;
}

/** Learned lines that are ready to be practised (again). */
export function dueCount(opening, level = getLevel()) {
  const now = Date.now();
  return idxs(opening, level).filter((i) => {
    const s = lineStats(opening.id, i, level);
    return lineUnlocked(opening.id, i, level) && (!s || s.due <= now);
  }).length;
}

export function summary() {
  const lines = Object.values(state.lines);
  const attempts = lines.reduce((a, s) => a + s.attempts, 0);
  const perfect = lines.reduce((a, s) => a + s.perfect, 0);
  return {
    attempts,
    accuracy: attempts ? perfect / attempts : 0,
    learned: lines.filter((s) => s.box >= 3).length,
    streak: streak(),
  };
}

export function streak() {
  let n = 0;
  const d = new Date();
  if (!state.days[today(d)]) d.setDate(d.getDate() - 1); // today not done yet – streak may still be alive
  while (state.days[today(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Lines of this opening completed at least once in Practice mode, at your level. */
export function linesLearned(opening, level = getLevel()) {
  return idxs(opening, level).filter((i) => (lineStats(opening.id, i, level)?.attempts || 0) > 0).length;
}
export const QUIZ_UNLOCK = 2;
export function quizUnlocked(opening, level = getLevel()) {
  return linesLearned(opening, level) >= Math.min(QUIZ_UNLOCK, idxs(opening, level).length);
}

/** Save a finished quiz round. Best is compared by percentage. */
export function recordQuiz(openingId, score, total) {
  state.quiz = state.quiz || {};
  const q = state.quiz[openingId] || { rounds: 0, best: 0, bestOf: total, last: 0 };
  q.rounds++;
  if (score / total >= q.best / (q.bestOf || 1)) { q.best = score; q.bestOf = total; }
  q.last = Date.now();
  state.quiz[openingId] = q;
  const d = today();
  state.days[d] = (state.days[d] || 0) + 1;
  save();
  return q;
}
export function quizStats(openingId) { return state.quiz?.[openingId] || null; }

/** Punish mode: remember which mistakes were solved (index -> { n, clean }). */
export function recordPunish(openingId, idx, clean) {
  state.punish = state.punish || {};
  const p = state.punish[openingId] || {};
  const e = p[idx] || { n: 0, clean: false };
  e.n++;
  e.clean = e.clean || clean;
  e.last = Date.now();
  p[idx] = e;
  state.punish[openingId] = p;
  const d = today();
  state.days[d] = (state.days[d] || 0) + 1;
  save();
  return e;
}
export function punishStats(openingId) { return state.punish?.[openingId] || {}; }

// ---- Starred openings (the ones you're learning) ----
// Kept as { id: { on, t } } rather than a list, so unstarring on one device survives a cloud merge.
export function isStarred(openingId) { return !!state.starred?.[openingId]?.on; }
export function toggleStar(openingId) {
  state.starred = state.starred || {};
  const on = !isStarred(openingId);
  state.starred[openingId] = { on, t: Date.now() };
  save();
  return on;
}
export function starredIds() { return Object.keys(state.starred || {}).filter(isStarred); }

export function activityDays() { return state.days; }
export function history() { return state.history; }

export function exportJson() { return JSON.stringify(state, null, 2); }
export function importJson(text) {
  const s = JSON.parse(text);
  if (!s || typeof s.lines !== 'object') throw new Error('Not a valid progress file');
  state = { ...blank(), ...s };
  save();
}
export function resetAll() { state = blank(); save(); }

// ---- Cloud sync helpers ----

/** A copy of the whole progress state (what cloud sync uploads). */
export function snapshot() { return JSON.parse(JSON.stringify(state)); }

/** Replace the state with `s` (already merged) without telling the save listeners. */
export function replaceState(s) {
  state = { ...blank(), ...s, settings: { ...blank().settings, ...s.settings } };
  save(false);
}

const hasProgress = (s) => Object.keys(s.lines || {}).length > 0 || (s.history || []).length > 0;
const newer = (a, b) => (!a ? b : !b ? a : (b.last || 0) > (a.last || 0) ? b : a);
function mergeMaps(a = {}, b = {}, pick) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

/**
 * Combine two copies of the progress state (this device and the cloud) without losing either
 * side's training. Counts can't be added up, because both copies usually share a history, so
 * each record keeps its most recent or best version.
 */
export function mergeStates(a, b) {
  if (!b) return a;
  if (!a) return b;
  const out = { ...b, ...a };
  out.lines = mergeMaps(a.lines, b.lines, newer);
  out.studied = mergeMaps(a.studied, b.studied, Math.max);
  out.days = mergeMaps(a.days, b.days, Math.max);
  const seen = new Set();
  out.history = [...(a.history || []), ...(b.history || [])]
    .filter((e) => { const k = `${e.t}|${e.id}|${e.line}|${e.level}`; return seen.has(k) ? false : seen.add(k); })
    .sort((x, y) => y.t - x.t).slice(0, 300);
  out.quiz = mergeMaps(a.quiz, b.quiz, (x, y) => {
    const best = y.best / (y.bestOf || 1) > x.best / (x.bestOf || 1) ? y : x;
    return { ...newer(x, y), rounds: Math.max(x.rounds, y.rounds), best: best.best, bestOf: best.bestOf, last: Math.max(x.last || 0, y.last || 0) };
  });
  out.punish = mergeMaps(a.punish, b.punish, (x, y) => mergeMaps(x, y, (p, q) => ({
    n: Math.max(p.n || 0, q.n || 0), clean: !!(p.clean || q.clean), last: Math.max(p.last || 0, q.last || 0),
  })));
  // Settings: a fresh device takes the saved ones; otherwise this device's choices win.
  out.settings = hasProgress(a) ? { ...b.settings, ...a.settings } : { ...a.settings, ...b.settings };
  out.starred = mergeMaps(a.starred, b.starred, (x, y) => ((y.t || 0) > (x.t || 0) ? y : x));
  for (const k of ['studied', 'quiz', 'punish', 'starred']) if (!a[k] && !b[k]) delete out[k];
  return out;
}
