// Progress tracking stored in localStorage (per device).
// Use Export / Import on the Progress page to move progress between devices.

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

export function lineStats(openingId, lineIdx) {
  return state.lines[`${openingId}:${lineIdx}`] || null;
}

export function recordLine(openingId, lineIdx, mistakes) {
  const key = `${openingId}:${lineIdx}`;
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
  state.history.unshift({ t: Date.now(), id: openingId, line: lineIdx, mistakes });
  state.history = state.history.slice(0, 300);
  save();
  return s;
}

/** 0..1 mastery for an opening (average box / 5 across its lines). */
export function mastery(opening) {
  const n = opening.lines.length;
  let sum = 0;
  opening.lines.forEach((_, i) => { sum += lineStats(opening.id, i)?.box || 0; });
  return sum / (n * 5);
}

/** Pick the next line to train: unseen or due first, weakest first. */
export function pickLine(opening, exclude = -1) {
  const now = Date.now();
  const scored = opening.lines.map((_, i) => {
    const s = lineStats(opening.id, i);
    let score;
    if (!s) score = -1000 + i; // unseen lines first, in order
    else if (s.due <= now) score = s.box * 10 + (s.due - now) / DAY;
    else score = 100 + (s.due - now) / DAY;
    return { i, score: score + (i === exclude ? 500 : 0) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].i;
}

export function dueCount(opening) {
  const now = Date.now();
  return opening.lines.filter((_, i) => { const s = lineStats(opening.id, i); return !s || s.due <= now; }).length;
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
