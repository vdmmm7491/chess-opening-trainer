// Progress tracking stored in localStorage (per device).
// Use Export / Import on the Profile page to move progress between devices.

import { LEVELS, LEVEL_KEYS, linesFor } from './openings.js';

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

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full / private mode */ }
}

export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getSettings() { return state.settings; }
export function setSetting(k, v) { state.settings[k] = v; save(); }

// ---- Training level (Beginner / Amateur / Intermediate / Advanced) ----
// Progress is kept per level: a line learned to move 6 is not the same as the full line.
// Advanced uses the plain `openingId:lineIndex` key, so progress saved before levels existed
// (when lines were trained in full) stays with the full lines.

/** Your training level. Unset: Advanced if you already have progress (old full lines), else Beginner. */
export function getLevel() {
  const l = state.settings.level;
  if (LEVELS[l]) return l;
  return Object.keys(state.lines).length ? 'advanced' : 'beginner';
}
export function setLevel(l) { if (LEVELS[l]) setSetting('level', l); }

const keyOf = (openingId, lineIdx, level) =>
  level === 'advanced' ? `${openingId}:${lineIdx}` : `${openingId}:${lineIdx}@${level}`;

export function lineStats(openingId, lineIdx, level = getLevel()) {
  return state.lines[keyOf(openingId, lineIdx, level)] || null;
}

export function recordLine(openingId, lineIdx, mistakes, level = getLevel()) {
  const key = keyOf(openingId, lineIdx, level);
  const s = state.lines[key] || { attempts: 0, perfect: 0, mistakes: 0, box: 0, due: 0, last: 0 };
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
 * Is Practice unlocked for this line at this level? Yes once it was learned at this level or a
 * deeper one (which contains it). Lines practised before the lock existed count as learned.
 */
export function lineUnlocked(openingId, lineIdx, level = getLevel()) {
  return LEVEL_KEYS.slice(LEVEL_KEYS.indexOf(level)).some((l) =>
    !!state.studied?.[keyOf(openingId, lineIdx, l)] || (lineStats(openingId, lineIdx, l)?.attempts || 0) > 0);
}

/** Can you practise anything in this opening yet? */
export function practiceUnlocked(opening, level = getLevel()) {
  return idxs(opening, level).some((i) => lineUnlocked(opening.id, i, level));
}

// Share of a line's progress you get for completing it once (any mistakes);
// the rest comes from its spaced-repetition level (box 0..5).
const PLAYED_CREDIT = 0.2;

/** 0..1 progress of one line: 0 unseen, 0.2 once completed, 1 at level 5. */
export function lineProgress(openingId, lineIdx, level = getLevel()) {
  const s = lineStats(openingId, lineIdx, level);
  if (!s || !s.attempts) return 0;
  return PLAYED_CREDIT + (1 - PLAYED_CREDIT) * (s.box / 5);
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
