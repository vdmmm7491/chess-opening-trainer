// Chess.com public API helpers (no login needed – the API is public and CORS-enabled).
// Docs: https://www.chess.com/news/view/published-data-api
import { Chess, findBook } from './ui.js';
import { classify, isSacrifice, drop, DROP, NEGATIVE, accuracy } from './classify.js';
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

// One shared download per account, so the Review and Progress tabs don't fetch the same games twice.
let gamesCache = null; // { user, months, games }

/** fetchGames() with a cache. A shorter period is cut from a longer download (by calendar month). */
export async function loadGames(username, months, onProgress) {
  const user = username.trim().toLowerCase();
  if (gamesCache && gamesCache.user === user && gamesCache.months >= months) {
    if (gamesCache.months === months) return gamesCache.games;
    const cut = new Date();
    cut.setHours(0, 0, 0, 0); cut.setDate(1); cut.setMonth(cut.getMonth() - months + 1);
    return gamesCache.games.filter((g) => g.end >= cut.getTime());
  }
  const games = await fetchGames(user, months, onProgress);
  gamesCache = { user, months, games };
  return games;
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
 * Run Stockfish over a game and classify its moves
 * (theory / top / only move / masterstroke / solid / dubious / mistake / blunder).
 * @param {{sans:string[], color?:'w'|'b'|null, startFen?:string}} game  `color` = your side.
 * @param {{maxPly?:number, depth?:number, both?:boolean, onStep?:(done:number,total:number)=>void}} opts
 *   both: rate your opponent's moves too (always the case when game.color is not set).
 * @returns {Promise<Array<{ply, san, loss, drop, best, fenBefore, kind, mine, wv?, wvEnd?}>>} one entry per
 *   rated move, in order; `kind` is a key of CLASSES in classify.js, `loss` is in centipawns, `wv` the
 *   evaluation of the position before the move (White's view, centipawns) when it was searched. When
 *   both sides are rated, the last entry also has `wvEnd`, the evaluation of the final position.
 *
 * Speed: each position is searched once (with the two best lines). The played move's score comes
 * from that search when it was one of those two lines, otherwise from the search of the next
 * position (which the next move needs anyway). Only moves that look like a mistake get a second,
 * deeper search of the played move from the same position to confirm it, as comparing two searches
 * from the same root is more stable than comparing consecutive positions.
 */
export async function engineCheck(engine, game, { maxPly = Infinity, depth = 12, both = false, onStep } = {}) {
  const startFen = game.startFen || START_FEN;
  const c = new Chess(startFen);
  const fens = [c.fen()], moves = [];
  for (const san of game.sans.slice(0, maxPly)) {
    try { moves.push(c.move(san)); } catch { break; }
    fens.push(c.fen());
  }
  const n = moves.length;
  const turnAt = (i) => fens[i].split(' ')[1];
  const rateAll = both || !game.color;
  const plies = [...Array(n).keys()].filter((i) => rateAll || turnAt(i) === game.color);
  const run = async (fen, opts) => {
    const r = await engine.analyse(fen, { depth, ...opts });
    if (r.cancelled) throw new Error('cancelled');
    return r;
  };
  // Best-play evaluation of position i (White's view), searched at most once.
  const evals = new Map();
  const evalAt = async (i) => {
    if (!evals.has(i)) {
      const p = new Chess(fens[i]);
      let e;
      if (p.isCheckmate()) e = { wv: p.turn() === 'w' ? -1500 : 1500, lines: [] };
      else if (p.isGameOver()) e = { wv: 0, lines: [] };
      else {
        const r = await run(fens[i], { multipv: 2 });
        e = { wv: clamp(r.info?.whiteCp ?? 0), lines: r.lines || [], bestmove: r.bestmove };
      }
      evals.set(i, e);
    }
    return evals.get(i);
  };

  const out = [];
  let done = 0;
  for (const ply of plies) {
    onStep?.(done++, plies.length);
    const mv = moves[ply], fen = fens[ply];
    const sign = turnAt(ply) === 'w' ? 1 : -1;
    const entry = { ply, san: mv.san, loss: 0, drop: 0, best: '', fenBefore: fen, mine: !game.color || turnAt(ply) === game.color };
    if (startFen === START_FEN) {
      const book = findBook(game.sans.slice(0, ply + 1));
      if (book && book.inBook && book.depth === ply + 1) { out.push({ ...entry, kind: 'theory' }); continue; }
    }
    const e = await evalAt(ply);
    if (!e.bestmove) continue;
    const playedUci = mv.from + mv.to + (mv.promotion || '');
    const bestScore = sign * e.wv;
    const isBest = e.bestmove === playedUci;
    let playedScore;
    if (isBest) playedScore = bestScore;
    else if (e.lines[1]?.pv?.[0] === playedUci) playedScore = sign * clamp(e.lines[1].whiteCp);
    else {
      // Rating both sides: the next position gets searched anyway, so use it. Otherwise search
      // this position restricted to the played move.
      playedScore = rateAll || evals.has(ply + 1)
        ? sign * (await evalAt(ply + 1)).wv
        : sign * clamp((await run(fen, { searchmoves: [playedUci] })).info?.whiteCp ?? 0);
      // Looks like a mistake: confirm with a deeper search of the played move from this position.
      // Shallow searches miss sacrificial combinations (e.g. Morphy's 15.Bxd7+ in the Opera Game).
      if (drop(bestScore, playedScore) >= DROP.dubious) {
        playedScore = sign * clamp((await run(fen, { depth: depth + 4, searchmoves: [playedUci] })).info?.whiteCp ?? 0);
      }
    }
    playedScore = Math.min(playedScore, bestScore);
    const last = ply > 0 ? moves[ply - 1] : null;
    const s = {
      bestScore, playedScore,
      secondScore: isBest && e.lines[1] ? sign * clamp(e.lines[1].whiteCp) : null,
      recapture: !!(mv.captured && last?.captured && last.to === mv.to),
      sacrifice: drop(bestScore, playedScore) < DROP.top && isSacrifice(fen, playedUci),
    };
    if (s.sacrifice) {
      // Shallow searches over-rate sacrifices; double-check at a greater depth.
      const deep = await run(fen, { depth: depth + 4 });
      s.deepConfirmed = deep.bestmove === playedUci
        || clamp(sign * (deep.info?.whiteCp ?? 0)) - clamp(sign * ((await run(fen, { depth: depth + 4, searchmoves: [playedUci] })).info?.whiteCp ?? 0)) <= 15;
    }
    let kind = classify(s);
    // In the first 3 moves each, a shallow browser engine judges offbeat but sound choices
    // (1.b3, 1...g6) too harshly: only real mistakes count there.
    if (ply < 6 && kind === 'dubious') kind = 'solid';
    if (!isBest && kind !== 'top') {
      try { entry.best = new Chess(fen).move({ from: e.bestmove.slice(0, 2), to: e.bestmove.slice(2, 4), promotion: e.bestmove[4] }).san; } catch { /* */ }
    }
    out.push({ ...entry, kind, wv: e.wv, loss: Math.max(0, bestScore - playedScore), drop: drop(bestScore, playedScore) });
  }
  // The final position too, for the evaluation graph of a whole-game review.
  if (rateAll && out.length && n === game.sans.length) out.at(-1).wvEnd = (await evalAt(n)).wv;
  onStep?.(plies.length, plies.length);
  return out;
}

/**
 * Classify one move with Stockfish: a search of the position (two best lines), plus a search
 * restricted to the played move when it wasn't the best. Used by the famous-games viewer.
 * @param {string} fen position before the move
 * @param {object} mv the chess.js move object; `last` is the move before it (for recaptures)
 * @returns {Promise<{kind, loss, best, eval, pv}|null>} `best` is the engine's move in SAN,
 *   `eval` the evaluation of the position before the move ({whiteCp, cp|mate, depth}), `pv` its best line (UCI).
 *   With `verify`, a move that looks dubious or worse is searched again 6 plies deeper before it is
 *   labelled (shallow searches sometimes miss the point of a strong move).
 *   Throws if the search is cancelled.
 */
export async function classifyMove(engine, fen, mv, last, { depth = 12, verify = false } = {}) {
  const sign = mv.color === 'w' ? 1 : -1;
  const score = (info) => clamp((info?.whiteCp ?? 0) * sign);
  const run = async (f, opts) => {
    const r = await engine.analyse(f, { depth, ...opts });
    if (r.cancelled) throw new Error('cancelled');
    return r;
  };
  const top = await run(fen, { multipv: 2 });
  if (!top.bestmove) return null;
  const playedUci = mv.from + mv.to + (mv.promotion || '');
  let bestScore = score(top.lines[0] || top.info);
  let isBest = top.bestmove === playedUci;
  let playedScore = isBest ? bestScore : score((await run(fen, { searchmoves: [playedUci] })).info);
  if (verify && drop(bestScore, playedScore) >= DROP.dubious) {
    const deep = await run(fen, { depth: depth + 6 });
    const deepPlayed = deep.bestmove === playedUci ? deep : await run(fen, { depth: depth + 6, searchmoves: [playedUci] });
    playedScore = score(deepPlayed.info);
    bestScore = Math.max(score(deep.info), playedScore);
    top.bestmove = deep.bestmove;
    top.lines = [deep.info];
    top.info = deep.info;
    isBest = deep.bestmove === playedUci || bestScore - playedScore <= 0;
  }
  const s = {
    bestScore, playedScore,
    secondScore: isBest && top.lines[1] ? score(top.lines[1]) : null,
    recapture: !!(mv.captured && last?.captured && last.to === mv.to),
    sacrifice: drop(bestScore, playedScore) < DROP.top && isSacrifice(fen, playedUci),
  };
  if (s.sacrifice) {
    // Shallow searches over-rate sacrifices; double-check at a greater depth.
    const deep = await run(fen, { depth: depth + 4 });
    s.deepConfirmed = deep.bestmove === playedUci
      || score(deep.info) - score((await run(fen, { depth: depth + 4, searchmoves: [playedUci] })).info) <= 15;
  }
  let best = mv.san;
  if (!isBest) {
    try { best = new Chess(fen).move({ from: top.bestmove.slice(0, 2), to: top.bestmove.slice(2, 4), promotion: top.bestmove[4] }).san; } catch { /* */ }
  }
  const info = top.lines[0] || top.info;
  const ev = info ? { whiteCp: info.whiteCp, depth: info.depth, ...(info.mate !== undefined ? { mate: info.mate } : { cp: info.cp }) } : null;
  return { kind: classify(s), loss: Math.max(0, bestScore - playedScore), drop: drop(bestScore, playedScore), best, eval: ev, pv: info?.pv?.slice(0, 8) || [] };
}

export function moveLabel(ply, san) {
  return `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '...'} ${san}`;
}

/**
 * Finished whole-game reviews (both sides) per game URL, shared between the Review tab and the game
 * analysis page, and kept in this browser (localStorage) so a game is analysed only once.
 * v3: entries carry evaluations (`wv`, `wvEnd`) for the evaluation graph.
 */
const REVIEW_KEY = 'opening-trainer.reviews.v3', MAX_REVIEWS = 60;
const reviews = (() => { try { return new Map(JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]')); } catch { return new Map(); } })();

/** @returns {{moves:Array, full:boolean}|null} */
export const getReview = (url) => (url && reviews.get(url)) || null;

export function saveReview(url, moves) {
  if (!url) return;
  reviews.delete(url);
  reviews.set(url, { moves: moves.map(({ fenBefore, ...m }) => m), full: true });
  while (reviews.size > MAX_REVIEWS) reviews.delete(reviews.keys().next().value);
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify([...reviews])); } catch { /* storage full or blocked */ }
}

/** Your dubious moves, mistakes and blunders from engineCheck() output, worst first. */
export const mistakesOf = (moves) => moves.filter((m) => m.mine !== false && NEGATIVE.includes(m.kind)).sort((a, b) => b.drop - a.drop || b.loss - a.loss);

/** Your accuracy (0–100) in a reviewed game, or null. */
export const myAccuracy = (moves) => accuracy(moves.filter((m) => m.mine !== false));

/** Link that opens a game on the game analysis page (whole-game report; explains your worst move). */
export function reviewHref(game, dev) {
  const q = new URLSearchParams({ moves: game.sans.join(' '), review: game.color, url: game.url, vs: game.opponent });
  if (dev) { q.set('dev', dev.ply); q.set('book', dev.expected.join(',')); }
  return '#/analysis?' + q.toString();
}
