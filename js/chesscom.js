// Chess.com public API helpers (no login needed – the API is public and CORS-enabled).
// Docs: https://www.chess.com/news/view/published-data-api
import { Chess } from './ui.js';
import { OPENINGS, lineMoves } from './openings.js';

const API = 'https://api.chess.com/pub/player/';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DRAWS =new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

async function getJson(url) {
  const r = await fetch(url);
  if (r.status === 404) throw new Error('Player not found on Chess.com');
  if (!r.ok) throw new Error(`Chess.com returned ${r.status}`);
  return r.json();
}

/** Fetch the user's standard-chess games from the last `months` monthly archives, newest first. */
export async function fetchGames(username, months, onProgress) {
  const user = username.trim().toLowerCase();
  const { archives } = await getJson(`${API}${encodeURIComponent(user)}/games/archives`);
  const recent = archives.slice(-months).reverse();
  const games = [];
  for (let i = 0; i < recent.length; i++) {
    onProgress?.(i / recent.length);
    const data = await getJson(recent[i]);
    games.push(...data.games.filter((g) => g.rules === 'chess' && g.pgn && (!g.initial_setup || g.initial_setup === START_FEN)));
  }
  onProgress?.(1);
  games.sort((a, b) => b.end_time - a.end_time);
  return games.map((g) => parseGame(g, user)).filter(Boolean);
}

export function parseGame(g, user) {
  const color = g.white.username.toLowerCase() === user ? 'w' : g.black.username.toLowerCase() === user ? 'b' : null;
  if (!color) return null;
  const me = color === 'w' ? g.white : g.black;
  const opp = color === 'w' ? g.black : g.white;
  const result = me.result === 'win' ? 'W' : DRAWS.has(me.result) ? 'D' : 'L';
  let sans = [];
  try {
    const c = new Chess();
    c.loadPgn(g.pgn);
    sans = c.history();
  } catch { return null; }
  const ecoUrl = (g.pgn.match(/\[ECOUrl "([^"]+)"\]/) || [])[1] || '';
  const eco = (g.pgn.match(/\[ECO "([^"]+)"\]/) || [])[1] || '';
  const fullName = ecoUrl ? decodeURIComponent(ecoUrl.split('/openings/')[1] || '').replace(/-/g, ' ').replace(/\s\d.*$/, '') : 'Unknown opening';
  return {
    url: g.url, end: g.end_time * 1000, timeClass: g.time_class, color, result,
    opponent: opp.username, oppRating: opp.rating, myRating: me.rating,
    sans, eco, opening: fullName, family: family(fullName),
  };
}

/** Group long names like "Sicilian Defense Najdorf Variation English Attack" into "Sicilian Defense". */
function family(name) {
  const words = name.split(' ');
  const keys = ['Defense', 'Defence', 'Game', 'Opening', 'Gambit', 'Attack', 'System'];
  for (let i = 0; i < Math.min(words.length, 4); i++) if (keys.includes(words[i])) return words.slice(0, i + 1).join(' ');
  return words.slice(0, 2).join(' ');
}

/** Stats per opening family and colour. */
export function openingStats(games) {
  const map = new Map();
  for (const g of games) {
    const k = g.color + '|' + g.family;
    const s = map.get(k) || { family: g.family, color: g.color, n: 0, W: 0, D: 0, L: 0 };
    s.n++; s[g.result]++;
    map.set(k, s);
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}

/**
 * Compare each game to the trainer's repertoire for the colour you played.
 * Returns the first move where you left a book line that the opponent's moves still matched.
 */
export function findDeviations(games) {
  const out = [];
  for (const g of games) {
    const lines = [];
    for (const o of OPENINGS) if (o.side === g.color) o.lines.forEach((l, i) => lines.push({ o, i, l, mv: lineMoves(l) }));
    for (let ply = 0; ply < Math.min(g.sans.length, 30); ply++) {
      const prefix = g.sans.slice(0, ply);
      const matching = lines.filter((x) => x.mv.length > ply && prefix.every((s, k) => x.mv[k] === s));
      if (!matching.length) break; // opponent (or we) went somewhere the repertoire doesn't cover
      const myTurn = (ply % 2 === 0) === (g.color === 'w');
      if (!myTurn) continue;
      const played = g.sans[ply];
      // Only count it once the game is clearly inside ONE opening (move 3+). Earlier differences are
      // just a different opening choice (e.g. 1...d5 instead of a King's Indian), not a mistake.
      const sameOpening = matching.every((x) => x.o === matching[0].o);
      if (ply >= 4 && sameOpening && !matching.some((x) => x.mv[ply] === played)) {
        const ref = matching[0];
        out.push({ game: g, ply, played, expected: [...new Set(matching.map((x) => x.mv[ply]))], opening: ref.o, lineIdx: ref.i, line: ref.l });
        break;
      }
    }
  }
  return out;
}

/** Group deviations by position + move so repeated habits stand out. */
export function groupDeviations(devs) {
  const map = new Map();
  for (const d of devs) {
    const k = d.game.sans.slice(0, d.ply).join(' ') + '|' + d.played;
    const e = map.get(k) || { ...d, count: 0, games: [] };
    e.count++; e.games.push(d.game);
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const clamp = (v) => Math.max(-1500, Math.min(1500, v));

/**
 * Run Stockfish over the opening phase of a game and report your inaccuracies/mistakes/blunders.
 * @returns {Promise<Array<{ply, san, loss, best, fenBefore, kind}>>}
 */
// For each of your moves we search the position twice at the same depth: once freely (best move)
// and once restricted to the move you played. Comparing two searches from the same root is far
// more stable than comparing evaluations of consecutive positions.
export const CHECK_PLIES = 24;

export async function engineCheck(engine, game, { maxPly = CHECK_PLIES, depth = 12, onStep } = {}) {
  const c = new Chess();
  const n = Math.min(game.sans.length, maxPly);
  const out = [];
  for (let ply = 0; ply < n; ply++) {
    const fen = c.fen();
    const mv = c.move(game.sans[ply]);
    const myTurn = (ply % 2 === 0) === (game.color === 'w');
    // Skip the first 3 moves each: they're theory, and a shallow browser engine judges offbeat
    // but sound choices (1.b3, 1...g6) too harshly.
    if (!myTurn || ply < 6) continue;
    const best = await engine.analyse(fen, { depth });
    if (best.cancelled) throw new Error('cancelled');
    onStep?.();
    const playedUci = mv.from + mv.to + (mv.promotion || '');
    if (!best.bestmove || best.bestmove === playedUci) continue;
    const played = await engine.analyse(fen, { depth, searchmoves: [playedUci] });
    if (played.cancelled) throw new Error('cancelled');
    const sign = game.color === 'w' ? 1 : -1;
    const bestScore = clamp((best.info?.whiteCp ?? 0) * sign);
    const playedScore = clamp((played.info?.whiteCp ?? 0) * sign);
    const loss = bestScore - playedScore;
    if (loss < 120) continue;
    const t = new Chess(fen);
    let bestSan = '';
    try { bestSan = t.move({ from: best.bestmove.slice(0, 2), to: best.bestmove.slice(2, 4), promotion: best.bestmove[4] }).san; } catch { /* */ }
    out.push({
      ply, san: game.sans[ply], loss, best: bestSan, fenBefore: fen,
      kind: loss >= 350 ? 'Blunder' : loss >= 220 ? 'Mistake' : 'Inaccuracy',
    });
  }
  return out;
}

export function moveLabel(ply, san) {
  return `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'} ${san}`;
}

/**
 * Engine results per game URL, shared between the Chess.com tab and the analysis board's game review,
 * so a game is only analysed once per visit. url -> Array<{ply, san, loss, best, kind}>
 */
export const reviewCache = new Map();

/** Link that opens a game in the analysis board in review mode (it finds and explains your worst move). */
export function reviewHref(game, dev) {
  const q = new URLSearchParams({ moves: game.sans.join(' '), review: game.color, url: game.url, vs: game.opponent });
  if (dev) { q.set('dev', dev.ply); q.set('book', dev.expected.join(',')); }
  return '#/analysis?' + q.toString();
}
