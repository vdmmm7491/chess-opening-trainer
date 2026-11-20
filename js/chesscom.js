// Chess.com public API helpers (no login needed – the API is public and CORS-enabled).
// Docs: https://www.chess.com/news/view/published-data-api
import { Chess, findBook } from './ui.js';
import { classify, isSacrifice } from './classify.js';
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
 * Run Stockfish over the opening phase of a game and classify each of your moves
 * (book / best / great / brilliant / good / inaccuracy / mistake / blunder).
 * @returns {Promise<Array<{ply, san, loss, best, fenBefore, kind}>>} one entry per classified move;
 *   `kind` is a key of CLASSES in classify.js.
 */
// For each of your moves we search the position twice at the same depth: once freely with the two
// best lines (to spot "only moves"), and once restricted to the move you played. Comparing two
// searches from the same root is far more stable than comparing evaluations of consecutive positions.
export const CHECK_PLIES = 24;

export async function engineCheck(engine, game, { maxPly = CHECK_PLIES, depth = 12, onStep } = {}) {
  const c = new Chess();
  const n = Math.min(game.sans.length, maxPly);
  const sign = game.color === 'w' ? 1 : -1;
  const score = (info) => clamp((info?.whiteCp ?? 0) * sign);
  const run = async (fen, opts) => {
    const r = await engine.analyse(fen, { depth, ...opts });
    if (r.cancelled) throw new Error('cancelled');
    return r;
  };
  const out = [];
  let prev = null;
  for (let ply = 0; ply < n; ply++) {
    const fen = c.fen();
    const mv = c.move(game.sans[ply]);
    const last = prev;
    prev = mv;
    const myTurn = (ply % 2 === 0) === (game.color === 'w');
    if (!myTurn) continue;
    const book = findBook(game.sans.slice(0, ply + 1));
    const inBook = book && book.inBook && book.depth === ply + 1;
    // Skip the first 3 moves each unless they're in the repertoire: they're theory, and a shallow
    // browser engine judges offbeat but sound choices (1.b3, 1...g6) too harshly.
    if (ply < 6 && !inBook) continue;
    if (ply >= 6) onStep?.();
    if (inBook) { out.push({ ply, san: mv.san, loss: 0, best: '', fenBefore: fen, kind: 'book' }); continue; }

    const top = await run(fen, { multipv: 2 });
    if (!top.bestmove) continue;
    const playedUci = mv.from + mv.to + (mv.promotion || '');
    const bestScore = score(top.lines[0] || top.info);
    const isBest = top.bestmove === playedUci;
    const playedScore = isBest ? bestScore : score((await run(fen, { searchmoves: [playedUci] })).info);
    const s = {
      bestScore, playedScore,
      secondScore: isBest && top.lines[1] ? score(top.lines[1]) : null,
      recapture: !!(mv.captured && last?.captured && last.to === mv.to),
      sacrifice: bestScore - playedScore <= 15 && isSacrifice(fen, playedUci),
    };
    if (s.sacrifice) {
      // Shallow searches over-rate sacrifices; double-check at a greater depth.
      const deep = await run(fen, { depth: depth + 4 });
      s.deepConfirmed = deep.bestmove === playedUci
        || score(deep.info) - score((await run(fen, { depth: depth + 4, searchmoves: [playedUci] })).info) <= 15;
    }
    const kind = classify(s);
    let bestSan = '';
    if (!isBest && kind !== 'best') {
      const t = new Chess(fen);
      try { bestSan = t.move({ from: top.bestmove.slice(0, 2), to: top.bestmove.slice(2, 4), promotion: top.bestmove[4] }).san; } catch { /* */ }
    }
    out.push({ ply, san: mv.san, loss: Math.max(0, bestScore - playedScore), best: bestSan, fenBefore: fen, kind });
  }
  return out;
}

export function moveLabel(ply, san) {
  return `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'} ${san}`;
}
