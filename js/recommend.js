// "What to learn next": find the openings that beat you most in your Chess.com games and point you
// at trainer openings that counter them – drill the line you already play, or learn a new weapon.
import { OPENINGS, LEVELS, lineMoves, levelForRating, getOpening } from './openings.js';

const MIN_GAMES = 3;   // ignore openings you've met only once or twice
const MIN_LOSSES = 2;  // "lost multiple times"
const MAX_SCORE = 0.5; // only openings where you score under 50%

/**
 * Hand-picked counters, keyed by the Chess.com opening family (lower case, letters only).
 * color = the colour YOU had in those games. The first pick that exists in the trainer is the main one.
 */
const COUNTERS = [
  // ---- you were White: the opponent's defence
  { color: 'w', match: /caro ?kann/, picks: [
    { id: 'alien-gambit', why: 'Sacrifices a knight on f7 on move 5 against the main line. Most Caro-Kann players have never seen it and the traps come fast.' },
    { id: 'advance-french-caro', why: 'Or the sound way: 3.e5 grabs space and takes the Caro-Kann player out of their comfort zone.' },
    { id: 'london', why: 'Or sidestep it: open with 1.d4 and the Caro-Kann never appears on the board.' }] },
  { color: 'w', match: /sicilian/, picks: [
    { id: 'alapin-sicilian', why: 'Keep 1.e4 and answer 1...c5 with 2.c3 and d4: a full centre and clear plans, without the huge Open Sicilian theory.' },
    { id: 'london', why: 'Open with 1.d4 and the Sicilian can\'t happen. The London is the same easy setup every game, so there is far less theory to learn.' },
    { id: 'queens-gambit', why: 'Or play 1.d4 2.c4 for a classical fight in the centre, again with no Sicilian.' }] },
  { color: 'w', match: /french/, picks: [
    { id: 'advance-french-caro', why: 'Keep 1.e4 and play 3.e5: you grab space, cramp Black\'s light-squared bishop and get kingside chances.' },
    { id: 'london', why: 'Open with 1.d4: French players don\'t get their closed, counter-punching structure, and your bishop gets out before ...e6 locks it in.' },
    { id: 'queens-gambit', why: 'Or 1.d4 2.c4, where ...e6 players often land in the Queen\'s Gambit Declined, which you will know better.' }] },
  { color: 'w', match: /scandinavian|center counter|centre counter/, picks: [
    { id: 'london', why: 'Open with 1.d4 and there is no early queen sortie to deal with.' },
    { id: 'queens-gambit', why: 'Or 1.d4 2.c4: you choose the structure instead of reacting to ...d5.' }] },
  { color: 'w', match: /pirc|modern|alekhine|owen|nimzowitsch defense|robatsch/, picks: [
    { id: 'london', why: 'Against offbeat 1.e4 replies, 1.d4 and the London give you one solid plan that works against almost anything.' }] },
  { color: 'w', match: /dutch/, picks: [
    { id: 'london', why: 'The London has a ready-made line against the Dutch: develop, castle and hit the weakened e6 square.' }] },
  { color: 'w', match: /kings indian|grunfeld|benoni|queens indian|nimzo|bogo|indian/, picks: [
    { id: 'london', why: 'The London keeps the same setup against ...g6 and ...b6 fianchettos, so you skip their sharp main lines.' }] },
  { color: 'w', match: /slav|queens gambit|tarrasch|chigorin|albin|catalan/, picks: [
    { id: 'queens-gambit', why: 'Covers the Slav, Semi-Slav, Accepted, Tarrasch, Albin and Chigorin replies to 1.d4 d5 2.c4.' },
    { id: 'london', why: 'Or keep it simple with 2.Bf4 and the same setup every game.' }] },
  { color: 'w', match: /petrov|russian|philidor|latvian|elephant|damiano/, picks: [
    { id: 'italian', why: 'Quick development aimed at f7: the natural way to punish passive or dubious 1...e5 defences.' },
    { id: 'scotch', why: 'Or open the centre straight away with 3.d4.' }] },
  // ---- you were Black: the opponent's opening (or the defence you chose)
  { color: 'b', match: /italian|giuoco|evans|two knights|ruy lopez|spanish|scotch|vienna|kings gambit|bishops opening|ponziani|four knights|kings knight|kings pawn opening|center game|centre game|danish/, picks: [
    { id: 'open-game-black', why: 'A prepared answer to every main 1.e4 e5 opening: Italian, Ruy López, Scotch, Vienna, King\'s Gambit and more.' },
    { id: 'caro-kann', why: 'Or avoid 1...e5 entirely: the Caro-Kann is solid and needs far less memorising.' }] },
  { color: 'b', match: /london|jobava|colle|zukertort|trompowsky|torre|queens pawn opening/, picks: [
    { id: 'kings-indian', why: 'Has lines against the London and the Trompowsky: fianchetto, castle and strike back with ...c5 or ...e5.' },
    { id: 'qgd', why: 'Or the classical answer: ...d5, ...e6 and ...c5 against the London and the Colle, with ready-made lines for both.' },
    { id: 'nimzo', why: 'Or play ...e6 and ...b6 setups that take the sting out of system openings.' }] },
  { color: 'b', match: /queens gambit|catalan|slav/, picks: [
    { id: 'qgd', why: 'The classical answer to the Queen\'s Gambit: hold d5 with ...e6, develop and castle. Covers the Exchange, 5.Bf4 and the Catalan too.' },
    { id: 'slav', why: 'Or the Slav: just as solid, and your light-squared bishop gets out before ...e6.' },
    { id: 'nimzo', why: 'Meet 1.d4 with 1...Nf6 and 2...e6: you get the Nimzo-Indian instead of defending the Queen\'s Gambit.' },
    { id: 'kings-indian', why: 'Or the King\'s Indian, a fighting answer that also skips the Queen\'s Gambit.' }] },
  { color: 'b', match: /dutch/, picks: [
    { id: 'dutch-stonewall', why: 'Covers the main fianchetto lines plus 2.Nc3, the Staunton Gambit and the London.' }] },
  { color: 'b', match: /english|reti|bird|larsen|nimzo larsen/, picks: [
    { id: 'kings-indian', why: 'The King\'s Indian setup works against almost every flank opening.' }] },
  { color: 'b', match: /sicilian/, picks: [
    { id: 'sicilian-classical', why: 'A real Open Sicilian with natural development and much less theory than the Najdorf. Covers the Rossolimo and the Alapin.' },
    { id: 'accelerated-dragon', why: 'Or the Accelerated Dragon: one fixed set-up (...g6, ...Bg7) and no Yugoslav Attack to fear.' },
    { id: 'sicilian-najdorf', why: 'Covers the Open Sicilian plus the Alapin, Smith-Morra, Closed, Grand Prix and 3.Bb5+.' },
    { id: 'caro-kann', why: 'Or switch to the Caro-Kann: much less theory and a very solid position.' }] },
  { color: 'b', match: /french/, picks: [
    { id: 'french', why: 'Covers the Advance, Winawer, Classical, Tarrasch and Exchange.' },
    { id: 'caro-kann', why: 'Or the Caro-Kann: a similar pawn structure without the locked-in light-squared bishop.' }] },
  { color: 'b', match: /caro ?kann/, picks: [
    { id: 'caro-kann', why: 'Covers the Advance, Classical, Exchange, Panov, Two Knights and Fantasy.' },
    { id: 'scandinavian', why: 'Or the Scandinavian: you decide the game\'s character from move 1.' }] },
  { color: 'b', match: /scandinavian|center counter|centre counter/, picks: [
    { id: 'scandinavian', why: 'Covers 3...Qa5, 3...Qd6 and White\'s sidelines.' },
    { id: 'caro-kann', why: 'Or the Caro-Kann for a slower, very solid game.' }] },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const commonPrefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const scoreOf = (s) => (s.W + s.D / 2) / s.n;
/** Chess.com writes "Caro Kann Defense"; show "Caro-Kann Defense". */
export const prettyFamily = (f) => String(f || 'Unknown opening').replace(/\bCaro Kann\b/i, 'Caro-Kann').replace(/\bRuy Lopez\b/i, 'Ruy López');

/** Your rating band: median of your ratings in the 15 most recent games. */
export function currentLevel(games) {
  const r = games.slice(0, 15).map((g) => g.myRating).filter(Number.isFinite).sort((a, b) => a - b);
  if (!r.length) return null;
  const rating = r[Math.floor(r.length / 2)];
  return { rating, level: levelForRating(rating) };
}
export const levelName = (k) => LEVELS[k]?.name || '';

/**
 * @param games parsed games from fetchGames(), newest first
 * @param {{mastery?: (o) => number}} [opts]
 * @returns {{level, items}} worst first. Item: { color, family, n, W, D, L, score, lost, picks: [{kind, opening, lineIdx?, why}] }
 */
export function recommend(games, { mastery = () => 0 } = {}) {
  const level = currentLevel(games);
  const groups = new Map();
  for (const g of games) {
    if (!g.sans?.length) continue;
    const k = g.color + '|' + g.family;
    const e = groups.get(k) || { color: g.color, family: g.family, n: 0, W: 0, D: 0, L: 0, games: [] };
    e.n++; e[g.result]++; e.games.push(g);
    groups.set(k, e);
  }
  const items = [];
  for (const e of groups.values()) {
    if (e.n < MIN_GAMES || e.L < MIN_LOSSES) continue;
    e.score = scoreOf(e);
    if (e.score >= MAX_SCORE) continue;
    items.push({ ...e, lost: e.games.filter((g) => g.result === 'L'), picks: picksFor(e, level, mastery) });
  }
  items.sort((a, b) => (b.L - b.W) - (a.L - a.W) || b.L - a.L || a.score - b.score);
  return { level, items };
}

function picksFor(e, level, mastery) {
  const lost = e.games.filter((g) => g.result === 'L');
  const mine = (ply) => (ply % 2 === 0) === (e.color === 'w');
  const start = e.color === 'w' ? 2 : 1; // the opponent has made their first choice by this ply
  const fits = (o) => !level || (o.levels || []).includes(level.level);
  const picks = [], seen = new Set();
  const add = (p) => { if (p.opening && !seen.has(p.opening.id)) { seen.add(p.opening.id); picks.push(p); } };

  // 1. Drill: a trainer line you already follow in these losses (2+ of your own moves past the opponent's first choice).
  let drill = null;
  for (const o of OPENINGS.filter((x) => x.side === e.color)) {
    o.lines.forEach((l, i) => {
      const mv = lineMoves(l);
      let hits = 0, depth = 0;
      for (const g of lost) {
        const d = commonPrefix(mv, g.sans);
        let own = 0;
        for (let p = start; p < d; p++) if (mine(p)) own++;
        if (own >= 2) { hits++; depth += d; }
      }
      if (hits && (!drill || hits * 100 + depth / hits > drill.rank)) drill = { opening: o, lineIdx: i, line: l, depth: Math.round(depth / hits), rank: hits * 100 + depth / hits };
    });
  }
  if (drill) {
    add({ kind: 'drill', opening: drill.opening, lineIdx: drill.lineIdx, line: drill.line,
      why: `You already play this. Your lost games left the line around move ${Math.floor(drill.depth / 2) + 1}; drill it until it's automatic.` });
  }

  // 2. Hand-picked counters for this opening.
  const fam = norm(e.family);
  const rule = COUNTERS.find((r) => r.color === e.color && r.match.test(fam));
  for (const p of rule?.picks || []) add({ kind: 'learn', opening: getOpening(p.id), why: p.why });

  // 3. Fallback: trainer openings for your colour whose lines start the way these games did.
  if (picks.length < 2) {
    const first = lost[0]?.sans || [];
    const cover = OPENINGS.filter((o) => o.side === e.color && o.lines.some((l) => commonPrefix(lineMoves(l), first) > start))
      .sort((a, b) => fits(b) - fits(a) || mastery(b) - mastery(a));
    for (const o of cover) add({ kind: 'learn', opening: o, why: o.levelNote || o.description || '' });
  }
  if (!picks.length && e.color === 'w') {
    // Nothing in the trainer for this reply: sidestep it with a different first move.
    const first = lost[0]?.sans?.[0];
    const other = OPENINGS.filter((o) => o.side === 'w' && lineMoves(o.lines[0])[0] !== first).sort((a, b) => fits(b) - fits(a));
    for (const o of other.slice(0, 2)) add({ kind: 'avoid', opening: o, why: o.levelNote || o.description || '' });
  }
  return picks.slice(0, 3).map((p) => ({ ...p, fits: fits(p.opening) }));
}
