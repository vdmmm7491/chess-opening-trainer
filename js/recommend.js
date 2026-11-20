// "What to learn next": find the openings you lose to most in your Chess.com games and point you at
// trainer openings that answer them – either drill the defence you already play, or learn a new one.
import { OPENINGS, LEVELS, lineMoves, levelForRating } from './openings.js';

const MIN_GAMES = 3; // ignore match-ups you've only met once or twice

/**
 * The part of the game that the opponent decided and you have to be ready for:
 * as Black, White's first move ("e4"); as White, your first move and Black's reply ("e4 c5").
 */
function matchupOf(g) {
  return g.color === 'b' ? g.sans.slice(0, 1) : g.sans.slice(0, 2);
}

/** "1.e4" / "1.e4 c5" / "1...e5" */
export function movesLabel(sans, startPly = 0) {
  return sans.map((s, i) => {
    const ply = startPly + i;
    if (ply % 2 === 0) return `${ply / 2 + 1}.${s}`;
    return i === 0 ? `${(ply + 1) / 2}...${s}` : s;
  }).join(' ');
}

const commonPrefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const score = (s) => (s.W + s.D / 2) / s.n;

/** The rating band you play at: median of your ratings in the most recent games. */
export function currentLevel(games) {
  const r = games.slice(0, 15).map((g) => g.myRating).filter(Number.isFinite).sort((a, b) => a - b);
  if (!r.length) return null;
  const rating = r[Math.floor(r.length / 2)];
  return { rating, level: levelForRating(rating) };
}

/**
 * @param games parsed games from fetchGames() (one colour or both), newest first
 * @param {object} [opts]
 * @param {(o) => number} [opts.mastery] 0..1 progress for a trainer opening (from progress.js)
 * @returns {{level, items: Array}} items worst first. Each item:
 *   { color, key: SAN[], n, W, D, L, score, families: [{name, L, n}], reply: SAN[]|null,
 *     fix: {opening, lineIdx, line, depth}|null, alternatives: [{opening, fits}], games }
 */
export function recommend(games, { mastery = () => 0 } = {}) {
  const lvl = currentLevel(games);
  const groups = new Map();
  for (const g of games) {
    const key = matchupOf(g);
    if (key.length < (g.color === 'b' ? 1 : 2)) continue;
    const k = g.color + '|' + key.join(' ');
    const e = groups.get(k) || { color: g.color, key, n: 0, W: 0, D: 0, L: 0, games: [] };
    e.n++; e[g.result]++; e.games.push(g);
    groups.set(k, e);
  }

  const items = [];
  for (const e of groups.values()) {
    if (e.n < MIN_GAMES || !e.L) continue;
    e.score = score(e);
    if (e.score >= 0.6) continue; // you're doing fine here
    items.push(describe(e, lvl, mastery));
  }
  // Most losses first; between equal counts, the lower score is the bigger problem.
  items.sort((a, b) => (b.L - b.W) - (a.L - a.W) || b.L - a.L || a.score - b.score);
  return { level: lvl, items };
}

function describe(e, lvl, mastery) {
  const lost = e.games.filter((g) => g.result === 'L');

  // Which named openings (Chess.com's ECO names) the losses came from.
  const fam = new Map();
  for (const g of e.games) {
    const f = fam.get(g.family) || { name: g.family, n: 0, L: 0 };
    f.n++; if (g.result === 'L') f.L++;
    fam.set(g.family, f);
  }
  const families = [...fam.values()].filter((f) => f.L).sort((a, b) => b.L - a.L || b.n - a.n).slice(0, 3);

  // As Black, your usual reply to their first move ("1...e5").
  let reply = null;
  if (e.color === 'b') {
    const counts = new Map();
    for (const g of e.games) if (g.sans[1]) counts.set(g.sans[1], (counts.get(g.sans[1]) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) reply = [top[0]];
  }

  // Trainer openings for your colour that cover this match-up at all.
  const cands = OPENINGS.filter((o) => o.side === e.color && o.lines.some((l) => commonPrefix(lineMoves(l), e.key) === e.key.length));

  // "Fix": the trainer line closest to the games you lost – how far into it you got before the
  // game left it. It only counts as the opening you play if at least two of YOUR moves after the
  // match-up follow it (1.e4 c6 2.d4 d5 3.e5 is the Advance, not the Alien Gambit's 3.Nc3).
  const mine = (ply) => (ply % 2 === 0) === (e.color === 'w');
  let fix = null;
  for (const o of cands) {
    o.lines.forEach((l, i) => {
      const mv = lineMoves(l);
      let depth = 0, hits = 0;
      for (const g of lost) {
        const d = commonPrefix(mv, g.sans);
        let own = 0;
        for (let p = e.key.length; p < d; p++) if (mine(p)) own++;
        if (own >= 2) { depth += d; hits++; }
      }
      if (!hits) return;
      // Prefer lines that match many lost games, then deeper matches.
      const rank = hits * 100 + depth / hits;
      if (!fix || rank > fix.rank) fix = { opening: o, lineIdx: i, line: l, depth: Math.round(depth / hits), hits, rank };
    });
  }

  // Alternatives: other trainer openings for this match-up, best fit for your level first,
  // then the ones you've already started learning.
  const fits = (o) => !lvl || (o.levels || []).includes(lvl.level);
  const rankAlts = (list) => list
    .map((o) => ({ opening: o, fits: fits(o), mastery: mastery(o), lines: o.lines.length }))
    .sort((a, b) => b.fits - a.fits || b.mastery - a.mastery || b.lines - a.lines)
    .slice(0, 2);
  let alternatives = rankAlts(cands.filter((o) => o !== fix?.opening));
  // As White, if the trainer has nothing against their reply, you can sidestep it with another first move.
  let avoid = false;
  if (e.color === 'w' && !cands.length) {
    alternatives = rankAlts(OPENINGS.filter((o) => o.side === 'w' && lineMoves(o.lines[0])[0] !== e.key[0]));
    avoid = alternatives.length > 0;
  }

  return { ...e, families, reply, fix, alternatives, avoid, lost };
}

export const levelName = (k) => LEVELS[k]?.name || '';

/**
 * Openings "What to learn next" points you to, with a short reason each.
 * @returns {Map<string, string>} opening id -> reason ("You score 40% as Black vs 1.e4")
 */
export function suggestedOpenings(games, opts) {
  const out = new Map();
  for (const it of recommend(games, opts).items.slice(0, 4)) {
    const vs = it.color === 'b' ? `as Black vs ${movesLabel(it.key)}` : `as White after ${movesLabel(it.key)}`;
    const why = `You score ${Math.round(it.score * 100)}% ${vs}`;
    // Only the top pick per match-up, so the marks stay few and meaningful.
    const alt = it.alternatives[0];
    if (it.fix) { if (!out.has(it.fix.opening.id)) out.set(it.fix.opening.id, `${why} – drill the ${it.fix.line.name} line`); }
    else if (alt && !out.has(alt.opening.id)) out.set(alt.opening.id, `${why} – ${it.avoid ? 'sidestep it with this' : 'learn this'}`);
  }
  return out;
}

/** Games from the last `days` days, or all of them if that leaves fewer than `min`. */
export function recentGames(games, days = 90, min = 20) {
  const cut = Date.now() - days * 86400000;
  const recent = games.filter((g) => g.end >= cut);
  return recent.length >= min ? recent : games;
}
