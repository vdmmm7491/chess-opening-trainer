// Suggested openings for the home page cards: the main pick for each of your weak spots from
// "What to learn next" (recommend() over your Chess.com games). Saved in settings as
// `suggested: { user, at, ids: { openingId: reason } }` and refreshed at most once a day.
import { getSettings, setSetting } from './progress.js';
import { recommend, prettyFamily } from './recommend.js';

const MONTHS = 3;           // same window as "What to learn next"
const MAX_AGE = 86400000;   // refresh once a day
const TOP = 5;              // weak spots that count

/** { openingId: reason } for the saved Chess.com user, or {} */
export function suggestedIds() {
  const s = getSettings().suggested;
  const user = (getSettings().chesscomUser || '').trim().toLowerCase();
  return s && user && s.user === user ? s.ids || {} : {};
}

/** Work out and save the suggestions from parsed games (newest first). */
export function saveSuggestions(games, user) {
  const { items } = recommend(games);
  const ids = {};
  for (const it of items.slice(0, TOP)) {
    const p = it.picks[0];
    if (!p || ids[p.opening.id]) continue;
    const side = it.color === 'w' ? 'White' : 'Black';
    ids[p.opening.id] = p.kind === 'drill'
      ? `You play this, but keep losing with it as ${side} vs the ${prettyFamily(it.family)}`
      : `Counters the ${prettyFamily(it.family)}, which you keep losing to as ${side}`;
  }
  const prev = getSettings().suggested;
  const next = { user: user.trim().toLowerCase(), at: Date.now(), ids };
  if (JSON.stringify(prev?.ids || null) !== JSON.stringify(ids) || prev?.user !== next.user || Date.now() - (prev?.at || 0) > MAX_AGE / 2) {
    setSetting('suggested', next);
  }
  return ids;
}

let running = null;
/** Refresh in the background when the saved suggestions are missing or a day old. Resolves true if they changed. */
export function refreshSuggestions() {
  const user = (getSettings().chesscomUser || '').trim();
  const s = getSettings().suggested;
  if (!user || (s && s.user === user.toLowerCase() && Date.now() - s.at < MAX_AGE)) return Promise.resolve(false);
  running ||= (async () => {
    try {
      const { loadGames } = await import('./chesscom.js');
      const before = JSON.stringify(suggestedIds());
      saveSuggestions(await loadGames(user, MONTHS), user);
      return JSON.stringify(suggestedIds()) !== before;
    } catch { return false; } finally { running = null; }
  })();
  return running;
}
