// Opening repertoire data.
// side:      the colour YOU play when training this opening ('w' or 'b').
// tier:      which TIERS group the opening is listed under on the home page.
// levels:    which LEVELS the opening suits (shown as badges on the card).
// levelNote: one sentence on why it suits those players (shown on the card).
// Each line is a space-separated list of SAN moves starting from the initial position: the
// FULL main line, which is what Advanced players learn. Lower levels get the same line cut
// after fewer moves (see LEVELS.upTo). Optional line fields:
//   from: 'amateur'  – only shown from this level up (sharp or rare sidelines)
//   keep: true       – never cut (trap lines and short refutations whose point is the last move)
// Main lines follow the most-played moves in the Lichess Masters database (OTB games, 2200+).
// To add an opening, append an object here – ids must be unique and never change
// (progress is stored by id + line index). Check your edits with tools/validate.html.

/**
 * Training levels, in order. `upTo` = the last move number of YOUR moves a line goes to
 * at that level (Advanced plays the whole line).
 */
export const LEVELS = {
  beginner: { name: 'Beginner', range: 'Under 1000', upTo: 6, blurb: 'The first 6 moves of each main line: the key ideas, nothing to cram.', color: '#34b37e' },
  amateur: { name: 'Amateur', range: '1000–1500', upTo: 10, blurb: 'Up to move 10, plus the common sidelines.', color: '#3b82f6' },
  intermediate: { name: 'Intermediate', range: '1500–2000', upTo: 14, blurb: 'Up to move 14, deep enough to reach the middlegame plans.', color: '#f08c00' },
  advanced: { name: 'Advanced', range: '2000+', upTo: Infinity, blurb: 'The full main lines, as deep as master games go (up to move 20+).', color: '#ef5350' },
};
export const LEVEL_KEYS = Object.keys(LEVELS);

/**
 * Opening tiers, easiest first: how hard the OPENING is to learn (the home page slider).
 * Separate from LEVELS, which set how deep each line goes. Colours differ from LEVELS on purpose.
 */
export const TIERS = {
  first: { name: 'First Openings', blurb: 'Simple plans and clear principles. Start here.', color: '#14a3b8' },
  next: { name: 'Next Steps', blurb: 'Richer structures and more theory, once the basics feel easy.', color: '#8b5cf6' },
  master: { name: 'Master Class', blurb: 'Sharp or deeply positional openings with heavy theory.', color: '#d6336c' },
};
export const TIER_KEYS = Object.keys(TIERS);

/** The tier the home page starts on for a training level. */
export function tierForLevel(level) {
  return level === 'beginner' ? 'first' : level === 'amateur' ? 'next' : 'master';
}

/**
 * Rough level for a Chess.com rating, used only to tailor suggestions from your own games.
 * The app itself never asks for a rating.
 */
export function levelForRating(rating) {
  return rating < 1000 ? 'beginner' : rating < 1500 ? 'amateur' : rating < 2000 ? 'intermediate' : 'advanced';
}

/** The moves of a line at a level: cut so it ends on your move number LEVELS[level].upTo. */
export function cutMoves(opening, line, level) {
  const mv = lineMoves(line);
  const upTo = LEVELS[level]?.upTo ?? Infinity;
  if (line.keep || upTo === Infinity) return mv;
  const plies = opening.side === 'w' ? 2 * upTo - 1 : 2 * upTo;
  return mv.slice(0, plies);
}

/**
 * The lines you train at a level: [{ idx, line, name, moves }], in data order. Lines marked
 * `from` a higher level are left out, and so is a line whose cut moves are the same as (or
 * part of) another line's, since training that one covers it. `idx` is the index into
 * opening.lines (progress is stored by it).
 */
export function linesFor(opening, level) {
  const li = LEVEL_KEYS.indexOf(level);
  const all = opening.lines
    .map((line, idx) => ({ idx, line, name: line.name, moves: cutMoves(opening, line, level) }))
    .filter((x) => !x.line.from || LEVEL_KEYS.indexOf(x.line.from) <= li);
  const str = all.map((x) => x.moves.join(' '));
  return all.filter((x, i) => !str.some((s, j) => j !== i && (
    (s === str[i] && j < i) || s.startsWith(str[i] + ' '))));
}

export const OPENINGS = [
  // ---------------- White ----------------
  {
    id: 'italian', name: 'Italian Game', eco: 'C50–C54', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Italian_Game',
    tier: 'first',
    levels: ['beginner', 'amateur', 'intermediate'],
    levelNote: 'Teaches the basics (fast development, castling, centre control) and stays playable all the way up.',
    description: 'Develop fast, aim the bishop at f7 and build a slow, solid centre with c3 and d3/d4.',
    lines: [
      { name: 'Giuoco Pianissimo', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8 Nf1 Be6 Bc2 d5 exd5 Bxd5 Ng3 Qd7 Be3 Bxe3 Rxe3 Rad8 Qe2' },
      { name: 'Two Knights – d3', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3 Na5 Bb5 a6 Ba4 b5 Bc2 c5 Nbd2 Nc6 Nf1 Re8 h3 h6 Ng3 Be6 d4 cxd4 cxd4 exd4 Nxd4 Nxd4 Qxd4 Rc8 Bb3 d5 e5' },
      { name: 'Giuoco Piano – c3 d4', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5 Qb3' },
      { name: 'Two Knights – 4.Ng5', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5 Bd6 d4 exd3 Nxd3 Qc7 b3 O-O Bb2 Ne4 Nc3' },
      { name: 'Evans Gambit', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O Nge7 Ng5 d5 exd5 Ne5 Qxd4 f6 Re1 Bb6 Qh4' },
      { name: 'vs 3...Be7 (Hungarian)', moves: 'e4 e5 Nf3 Nc6 Bc4 Be7 d4 exd4 Nxd4 d6 O-O Nf6 Nc3 O-O Re1' },
      { name: 'vs 3...Nd4 – don\'t take e5!', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 c3' },
    ],
  },
  {
    id: 'ruy-lopez', name: 'Ruy López', eco: 'C60–C99', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Ruy_Lopez',
    tier: 'next',
    levels: ['amateur', 'intermediate', 'advanced'],
    levelNote: 'Deep theory and slow manoeuvring plans pay off once you understand pawn structures.',
    description: 'The Spanish: pressure the e5 defender with Bb5 and play for a long-term central advantage.',
    lines: [
      { name: 'Closed Morphy', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7 Nbd2 cxd4 cxd4 Nc6 Nb3 a5 Be3 a4 Nbd2 Bd7 Rc1 Qb7 Qe2 Rfe8 Bd3 Rab8 dxe5' },
      { name: 'Berlin Defence', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ke8 h3 h5 Bf4 Be7 Rad1 Be6 Ng5 Rh6 Rfe1 Bb4 g4 hxg4 hxg4 Ne7 Nxe6 Rxe6 Re3 Ng6 Bg3 Bxc3 bxc3' },
      { name: 'Exchange Variation', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1 Bg4 f3 Be6 Bf4 c4 Nd4 O-O-O Nc3 Bf7 Nf5 Rxd1+ Rxd1' },
      { name: 'Marshall Attack', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 d4 Bd6 Re1 Qh4 g3 Qh3 Be3 Bg4 Qd3 Rae8 Nd2 Re6 a4 Qh5 axb5 axb5 Nf1', from: 'intermediate' },
      { name: 'Open Ruy López', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5 Be6 c3 Bc5 Nbd2 O-O Bc2 Nxf2 Rxf2 f6 exf6 Bxf2+ Kxf2 Qxf6 Nf1 Ne5 Be3 Rae8 Bc5 Nxf3 gxf3 Rf7 Ng3 Bg4 Kg1' },
      { name: 'Schliemann Gambit', moves: 'e4 e5 Nf3 Nc6 Bb5 f5 Nc3 fxe4 Nxe4 d5 Nxe5 dxe4 Nxc6 Qg5 Qe2 Nf6 f4 Qxf4 Ne5+ c6 d4 Qh4+ g3 Qh3 Bc4 Be6 Bg5 O-O-O O-O-O Bd6 Qf1', from: 'amateur' },
      { name: 'Steinitz Defence', moves: 'e4 e5 Nf3 Nc6 Bb5 d6 d4 Bd7 Nc3 Nf6 O-O Be7 Re1 exd4 Nxd4 O-O Bxc6 bxc6 Qf3' },
      { name: 'Classical 3...Bc5', moves: 'e4 e5 Nf3 Nc6 Bb5 Bc5 c3 Nf6 O-O O-O d4 Bb6 Re1 d6 h3' },
    ],
  },
  {
    id: 'scotch', name: 'Scotch Game', eco: 'C44–C45', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Scotch_Game',
    tier: 'first',
    levels: ['beginner', 'amateur', 'intermediate'],
    levelNote: 'Open, direct positions with clear plans and little theory to memorise.',
    description: 'Open the centre immediately with d4 for active, direct piece play.',
    lines: [
      { name: 'Mieses Variation', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6 b3 g6 f4 d6 Qf2 Nf6 Be2 dxe5 O-O Ne4 Qe1 O-O-O Nc3' },
      { name: 'Classical 4...Bc5', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nxc6 Qf6 Qd2 dxc6 Nc3 Be6 Na4 Rd8 Bd3 Bd4 O-O b5 Nc3' },
      { name: 'vs 4...Qh4', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4 Nc3 Bb4 Be2 Qxe4 Nb5 Bxc3+ bxc3 Kd8 O-O' },
      { name: 'vs 4...Nxd4', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nxd4 Qxd4 d6 Bd3 Nf6 O-O Be7 Nc3' },
      { name: 'vs 3...d6', moves: 'e4 e5 Nf3 Nc6 d4 d6 Bb5 Bd7 Nc3 exd4 Nxd4 Nxd4 Bxd7+ Qxd7 Qxd4' },
    ],
  },
  {
    id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06–D69', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Queen%27s_Gambit',
    tier: 'next',
    levels: ['amateur', 'intermediate', 'advanced'],
    levelNote: 'Positional and principled. Best once you are comfortable with slower, strategic games.',
    description: 'Offer the c-pawn to deflect Black from the centre. Positional, principled, timeless.',
    lines: [
      { name: 'QGD Orthodox', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5 Bxe7 Qxe7 O-O Nxc3 Rxc3 e5 dxe5 Nxe5 Nxe5 Qxe5 f4 Qe4 Qe2' },
      { name: 'Queen\'s Gambit Accepted', moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 dxc5 Qxd1 Rxd1 Bxc5 a3 b5 Be2 Bb7 b4 Be7 Bb2 Nbd7 Nbd2 O-O Rac1' },
      { name: 'Slav Defence', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O Qe2 Nbd7 e4 Bg6 Bd3 Bh5 e5 Nd5 Nxd5 cxd5 Qe3 Be7 Ng5 Bxg5 Qxg5 Bg6 Be2 Nb8 Qxd8' },
      { name: 'QGD Exchange', moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 Nbd7 Qc2 Re8 Nf3 Nf8 O-O c6 h3 g6 Rab1 Ne6 Bh4 Ng7 b4 a6 a4 Bf5 b5 axb5 axb5 Bxd3 Qxd3' },
      { name: 'Semi-Slav', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Qc2 Bd6 Bd3 O-O O-O dxc4 Bxc4 b5 Be2 Bb7 Rd1 Qc7 e4 e5 Bg5 exd4 Rxd4 Ne5 g3 Bc5 Rd2 Nfg4 Nd1 Bb4 Rd4 Ba5 Nxe5 Qxe5 Rd7' },
      { name: 'Tarrasch Defence', moves: 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O Bg5 cxd4 Nxd4 h6 Be3 Re8 Rc1 Bf8 Nxc6 bxc6 Na4 Bd7 Bc5 Bxc5 Nxc5 Bg4 Re1 Qa5 h3 Bf5 Qd4 Rab8 a3' },
      { name: 'Albin Countergambit', moves: 'd4 d5 c4 e5 dxe5 d4 Nf3 Nc6 g3 Be6 Nbd2 Qd7 Bg2 O-O-O O-O', from: 'amateur' },
      { name: 'Chigorin Defence', moves: 'd4 d5 c4 Nc6 Nc3 dxc4 Nf3 Nf6 e4 Bg4 Be3 e6 Bxc4 Bb4 Qc2 O-O Rd1 Qe7 Be2 e5 d5', from: 'amateur' },
    ],
  },
  {
    id: 'london', name: 'London System', eco: 'D02 / A48', side: 'w',
    source: 'https://en.wikipedia.org/wiki/London_System',
    tier: 'first',
    levels: ['beginner', 'amateur'],
    levelNote: 'The same setup against almost everything, so there is very little to memorise.',
    description: 'A reliable setup: d4, Bf4, e3, Nf3, c3 and Bd3 against almost anything.',
    lines: [
      { name: 'vs ...d5 & ...c5', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3 b6 Qe2 Bb7 Rd1 Ne7 Bxd6 Qxd6 O-O' },
      { name: 'vs King\'s Indian setup', moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 c5 c3 Nc6 O-O cxd4 exd4 Nd5 Bh2' },
      { name: 'vs early ...c5 & ...Qb6', moves: 'd4 Nf6 Bf4 c5 e3 Qb6 Nc3 Qxb2 Nb5' },
      { name: 'vs ...Bf5', moves: 'd4 d5 Bf4 Nf6 e3 Bf5 c4 e6 Nc3 c6 Qb3 Qb6 c5 Qxb3 axb3 Nbd7 b4' },
      { name: 'vs Queen\'s Indian setup', moves: 'd4 Nf6 Bf4 e6 e3 b6 Nf3 Bb7 h3 Be7 Bd3 O-O O-O c5 c3 d6 Nbd2 Nbd7 Qe2' },
      { name: 'vs Dutch', moves: 'd4 f5 Bf4 Nf6 e3 e6 Nf3 Be7 h3 O-O Bd3' },
      { name: 'Jobava – vs ...g6 & ...d5', moves: 'd4 Nf6 Bf4 g6 Nc3 d5 e3 Bg7 h4 h5 Nf3 O-O Ne5 c5 Qd2 Nc6 f3' },
    ],
  },
  {
    id: 'english', name: 'English Opening', eco: 'A10–A39', side: 'w',
    source: 'https://en.wikipedia.org/wiki/English_Opening',
    tier: 'master',
    levels: ['intermediate', 'advanced'],
    levelNote: 'Flexible and transpositional. You need a feel for structures more than memorised lines.',
    description: 'Flexible flank opening – control d5 with c4, fianchetto and play a reversed Sicilian.',
    lines: [
      { name: 'Reversed Sicilian', moves: 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7 d3 O-O Be3 Be6 Rc1 f5 a3 Kh8 b4 a6 Bc5 Bxc5 bxc5 Nd7 d4 e4 d5 exf3 Bxf3 Nxc5 dxe6 Nxe6 Bxc6 bxc6 e3' },
      { name: 'Symmetrical', moves: 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 e6 O-O Nge7 d3 O-O Rb1' },
      { name: 'Four Knights', moves: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3' },
      { name: 'vs King\'s Indian setup', moves: 'c4 Nf6 Nc3 g6 g3 Bg7 Bg2 O-O Nf3 d6 O-O e5 d3 Nc6 Rb1 a5 a3 h6 b4 axb4 axb4 Be6 b5 Ne7 Bb2 Qd7 Re1 Bh3 Bh1 Ng4 Qb3' },
      { name: 'Mikenas Attack', moves: 'c4 Nf6 Nc3 e6 e4 d5 e5 d4 exf6 dxc3 bxc3 Qxf6 Nf3 e5 Bd3 Na6 O-O Bd6 Bc2 Bg4 d4 Bxf3 Qxf3 Qxf3 gxf3 exd4 Re1+' },
      { name: 'vs 1...c6', moves: 'c4 c6 Nf3 d5 e3 Nf6 Nc3 e6 b3 Bd6 Bb2 O-O Be2 Nbd7 Qc2 Re8 O-O b6 d4 Bb7 Rad1 Qe7 Rfe1 Rad8 Bf1 c5 cxd5 exd5 g3 Rc8 Bh3 cxd4 exd4 Ne4 Qd3 Qd8 Bf5' },
      { name: 'vs 1...e6', moves: 'c4 e6 Nc3 d5 d4 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 h3 g6 Rab1 Ne6 Bh4 Ng7 b4 a6 a4 Bf5 b5 axb5 axb5 Bxd3 Qxd3' },
    ],
  },
  {
    id: 'vienna', name: 'Vienna Game', eco: 'C25–C29', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Vienna_Game',
    tier: 'first',
    levels: ['beginner', 'amateur'],
    levelNote: 'Aggressive, full of traps, and opponents at club level often go wrong early.',
    description: 'Nc3 first, then an early f4 – an aggressive weapon against 1...e5.',
    lines: [
      { name: 'Vienna Gambit', moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4 O-O Bd3 f5 exf6 Bxf6 O-O' },
      { name: 'vs 2...Nc6', moves: 'e4 e5 Nc3 Nc6 Bc4 Nf6 d3 Bb4 Bg5 h6 Bxf6 Bxc3+ bxc3 Qxf6 Ne2 d6 O-O' },
      { name: 'Gambit Accepted 3...exf4', moves: 'e4 e5 Nc3 Nf6 f4 exf4 e5 Ng8 Nf3 d6 d4' },
      { name: 'Copycat 3...Nxe4', moves: 'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Be7 Nf3 Nc6 Nxe5 g6 Nxc6 dxc6 Qf3' },
      { name: 'Bc4 vs 3...Bc5', moves: 'e4 e5 Nc3 Nf6 Bc4 Bc5 d3 d6 f4 Nc6 Nf3 Bg4 Na4 Bb6 Nxb6 axb6 O-O' },
      { name: 'vs 2...Bc5', moves: 'e4 e5 Nc3 Bc5 Nf3 d6 Na4' },
    ],
  },

  {
    id: 'alapin-sicilian', name: 'Alapin Sicilian', eco: 'B22', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Sicilian_Defence,_Alapin_Variation',
    tier: 'next',
    levels: ['amateur', 'intermediate'],
    levelNote: 'Sidesteps the huge Open Sicilian theory with c3 and d4, giving clear plans (often an isolated d-pawn) you can learn in an afternoon.',
    description: 'Meet 1...c5 with 2.c3 and d4: a full pawn centre, quick development and no Najdorf theory to cram. Championed by GMs Sveshnikov and Tiviakov.',
    lines: [
      { name: '2...d5 – IQP main line', moves: 'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be2 Nc6 O-O cxd4 cxd4 Be7 Nc3 Qd6 Nb5 Qd8 Bf4 Nd5 Bg3 a6 Nc3 O-O Bd3' },
      { name: '2...Nf6 3.e5', moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 Bc4 Nb6 Bb3 d5 exd6 Qxd6 O-O Be6 Bxe6 Qxe6 Nxd4 Nxd4 Qxd4 Rd8 Qf4' },
      { name: '2...e6', moves: 'e4 c5 c3 e6 d4 d5 exd5 exd5 Nf3 Nc6 Bb5 Bd6 dxc5 Bxc5 O-O Nge7 Nbd2 O-O Nb3 Bb6 Re1' },
      { name: '2...Nc6', moves: 'e4 c5 c3 Nc6 d4 d5 exd5 Qxd5 Nf3 Bg4 Be2 cxd4 cxd4 e6 h3 Bh5 Nc3 Qa5 O-O Nf6 Be3 Be7 a3' },
      { name: '2...d6', moves: 'e4 c5 c3 d6 d4 Nf6 Bd3 cxd4 cxd4 g6 Nc3 Bg7 h3 O-O Nf3 Nc6 O-O' },
      { name: '2...g6', moves: 'e4 c5 c3 g6 d4 cxd4 cxd4 d5 e5 Nc6 Nc3 Bg7 Bb5 Bd7 Nf3 Nh6 O-O', from: 'amateur' },
    ],
  },
  {
    id: 'advance-french-caro', name: 'Advance vs French & Caro-Kann', eco: 'C02 / B12', side: 'w',
    source: 'https://en.wikipedia.org/wiki/French_Defence#Advance_Variation',
    tier: 'next',
    levels: ['amateur', 'intermediate'],
    levelNote: 'One idea (e5, grab space) against both of the solid 1.e4 defences, so you learn two answers for the price of one.',
    description: 'Push e5 against the French and the Caro-Kann: a space advantage, a cramped opponent and kingside chances.',
    lines: [
      { name: 'French – 6.a3 c4', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2 Na5 Rb1 Bd7 Be2 Ne7 O-O Nc8 Re1 Be7 Nf1' },
      { name: 'French – 5...Bd7', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 O-O Ng6 g3 Be7 h4 cxd4 cxd4 O-O h5 Nh8 Nc3' },
      { name: 'French – 6...Nh6', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 Nh6 b4 cxd4 cxd4 Nf5 Bb2 Be7 Bd3 a5 Bxf5 exf5 Nc3' },
      { name: 'Caro-Kann – Short system', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7 O-O Ne7 c4 dxc4 Na3 Nd5 Nxc4 Be7 Rc1' },
      { name: 'Caro-Kann – 3...c5', moves: 'e4 c6 d4 d5 e5 c5 dxc5 Nc6 Bb5 e6 Be3 Nge7 c3 Bd7 Nf3 Nf5 Bd4' },
      { name: 'Caro-Kann – 5...Nd7', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 Nd7 O-O h6 Nbd2 Ne7 Nb3 Bh7 c3' },
    ],
  },
  {
    id: 'catalan', name: 'Catalan Opening', eco: 'E01–E09', side: 'w',
    source: 'https://en.wikipedia.org/wiki/Catalan_Opening',
    tier: 'master',
    levels: ['intermediate', 'advanced'],
    levelNote: 'Long-term pressure rather than quick attacks: you often give a pawn and need to judge when to win it back.',
    description: 'Queen\'s Gambit pawns plus a fianchettoed bishop on g2 that presses on d5 and b7. A favourite of Kramnik and Carlsen.',
    lines: [
      { name: 'Open – 5...Be7', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 Be7 O-O O-O Qc2 a6 a4 Bd7 Qxc4 Bc6 Bg5 Bd5 Qc2 Be4 Qc1' },
      { name: 'Open – 5...c5', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 c5 O-O Nc6 Qa4 cxd4 Nxd4 Qxd4 Bxc6+ Bd7 Rd1 Qxd1+ Qxd1 Bxc6 Nd2' },
      { name: 'Open – 5...Bb4+', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 Bb4+ Bd2 a5 Qc2 Bxd2+ Qxd2 c6 a4 b5 axb5 cxb5 Qg5 O-O Qxb5' },
      { name: 'Closed Catalan', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O c6 Qc2 Nbd7 Nbd2 b6 e4 Ba6 b3 Rc8 Bb2' },
      { name: 'vs 3...Bb4+', moves: 'd4 Nf6 c4 e6 g3 Bb4+ Bd2 Be7 Bg2 d5 Nf3 O-O O-O c6 Qc2 b6 Bf4' },
      { name: 'vs 3...c5', moves: 'd4 Nf6 c4 e6 g3 c5 d5 exd5 cxd5 d6 Nc3 g6 Bg2 Bg7 Nf3 O-O O-O' },
    ],
  },

  {
    id: 'alien-gambit', name: 'Alien Gambit', eco: 'B15', side: 'w',
    source: 'https://ramachess.com/articles/alien-gambit/',
    tier: 'first',
    levels: ['beginner', 'amateur'],
    levelNote: 'Full of traps and great in fast games below club level. Objectively unsound: Stockfish gives Black about −1.8 with correct defence.',
    description: 'Witty Alien\'s 2023 gambit against the Caro-Kann: after 4...Nf6, play 5.Ng5 and sacrifice the knight on f7 to drag Black\'s king out.',
    lines: [
      { name: 'Main line – 7.Nf3 c5 8.Bc4+', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7 Kxf7 Nf3 c5 Bc4+ e6 Qe2 cxd4 Bd2 Nc6 O-O-O' },
      { name: 'Trap – the king walks forward', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7 Kxf7 Nf3 c5 Bc4+ Kg6 Ne5+ Kh7 Qd3+ g6 Qxg6#', keep: true },
      { name: 'Trap – 7...Bg4?', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7 Kxf7 Nf3 Bg4 Ne5+ Ke8 Nxg4', keep: true },
      { name: 'Trap – 7...Qd5?', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7 Kxf7 Nf3 Qd5 Bc4 Qxc4 Ne5+ Kg8 Nxc4', keep: true },
      { name: '7.Bc4+ Be6 (best defence)', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7 Kxf7 Bc4+ Be6 Bxe6+ Kxe6 c4 Kf7 Nf3 e6 O-O' },
      { name: 'vs 5...Bf5', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 Bf5 Bd3 Bxd3 Qxd3 h6 N5f3 e6 Ne5 Be7 c3' },
      { name: 'vs 5...c5', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 c5 Bc4 e6 Ne2 a6 a4 Nc6 Nf3 b6 O-O' },
    ],
  },

  // ---------------- Black ----------------
  {
    id: 'sicilian-najdorf', name: 'Sicilian Najdorf', eco: 'B90–B99', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Sicilian_Defence,_Najdorf_Variation',
    tier: 'master',
    levels: ['intermediate', 'advanced'],
    levelNote: 'Very sharp with huge amounts of theory. One wrong move can lose on the spot.',
    description: 'The sharpest answer to 1.e4. ...a6 keeps options open for ...e5 or ...e6 and queenside play.',
    lines: [
      { name: 'English Attack', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5 g5 b4 Ne2 Ne8 f4 a5 f5 a4 Nbd4 exd4 Nxd4 b3 Kb1 bxc2+ Nxc2 Bb3 axb3 axb3' },
      { name: '6.Bg5', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7 g4 b5 Bxf6 Nxf6 g5 Nd7 f5 Bxg5+ Kb1 Ne5 Qh5 Qd8 h4 Bf6 fxe6 O-O Bh3 fxe6 Bxe6+ Kh8 Nd5 Nc4' },
      { name: '6.Be2 Classical', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6 Qd2 Nbd7 a4 Rc8 a5 Qc7 Rfd1 Rfd8 Qe1 Qc6 Bf3 h6 Nc1 Qc7' },
      { name: 'vs Alapin 2.c3', moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4 Nb6 Bb5 dxe5 Nxe5 Bd7 Nxd7 Qxd7 Nc3 e6 O-O Rd8 Be3 Be7 Qg4 O-O Rad1 g6 d5 Nxd5 Bxa7 h5 Qh3 Qc7' },
      { name: '6.Bc4 Fischer–Sozin', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bc4 e6 Bb3 b5 O-O Be7 Qf3 Qc7 Qg3 O-O Bh6 Ne8 Rad1 Bd7 Nf3 Nc6' },
      { name: '6.f4', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 f4 e5 Nf3 Nbd7 a4 Be7 Bd3 O-O O-O exf4 Kh1 Nc5 Bxf4 Bg4 Qd2 Bh5 Nd4 Bg6', from: 'amateur' },
      { name: '6.h3', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 h3 e5 Nde2 h5 g3 Be6 Bg2 b5 O-O Nbd7 Be3 Be7 Nd5 Nxd5 exd5 Bf5 f4 Rc8 c3 Bh7 fxe5 dxe5 d6 Bg5 Qd2 Bxe3+ Qxe3 O-O Rad1 Rb8', from: 'intermediate' },
      { name: 'vs 3.Bb5+', moves: 'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6 c3 Nf6 d4 Nxe4 d5 Ne5 Re1 Nxf3+ Qxf3 Nf6 c4 e5 dxe6 fxe6 Bg5 Be7 Nc3 h6 Bh4 O-O Qh3 Kf7' },
      { name: 'vs Smith-Morra Gambit', moves: 'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6 O-O Nf6 Qe2 Be7 Rd1 e5 Be3 O-O Rac1 Be6' },
      { name: 'vs Closed Sicilian', moves: 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 Be3 Rb8 Qd2 b5 Nge2 b4 Nd1 Nd4 O-O e6 Nc1 Ne7 c3 bxc3 bxc3 Ndc6 Bh6 O-O Bxg7 Kxg7 Ne3 e5' },
      { name: 'vs Grand Prix Attack', moves: 'e4 c5 Nc3 d6 f4 Nc6 Nf3 g6 Bc4 Bg7 O-O e6 d3 Nge7 Qe1 O-O f5 gxf5 Qh4 fxe4 dxe4 Ng6 Qh5 Nce5' },
    ],
  },
  {
    id: 'sicilian-classical', name: 'Classical Sicilian', eco: 'B56–B69', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Sicilian_Defence,_Classical_Variation',
    tier: 'next',
    levels: ['amateur', 'intermediate'],
    levelNote: 'A real Open Sicilian with natural developing moves (...Nc6, ...d6, ...e5 or ...e6), far less theory than the Najdorf.',
    description: '2...Nc6, ...Nf6 and ...d6: develop naturally, fight for d4 and counter-attack on the queenside.',
    lines: [
      { name: 'Richter-Rauzer 6.Bg5', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bg5 e6 Qd2 a6 O-O-O Bd7 f4 b5 Bxf6 gxf6 Kb1 Qb6 Nxc6 Bxc6' },
      { name: '6.Be2', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6 Bf3 a5' },
      { name: 'Sozin 6.Bc4', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Bc4 Qb6 Nb3 e6 O-O Be7 Be3 Qc7 f4 O-O Bd3 a6' },
      { name: '6.Be3', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Be3 e5 Nb3 Be6 Be2 Be7 O-O O-O Qd2 a5 a4 Nb4' },
      { name: '6.f3', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 f3 e5 Nb3 Be7 Be3 O-O Qd2 a5' },
      { name: 'vs Rossolimo 3.Bb5', moves: 'e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7 Re1 e5 Bxc6 dxc6 d3 Qe7 a4 Nf6' },
      { name: 'vs Alapin 3.c3', moves: 'e4 c5 Nf3 Nc6 c3 Nf6 e5 Nd5 d4 cxd4 cxd4 d6 Bc4 Nb6 Bb5 dxe5 Nxe5 Bd7' },
    ],
  },
  {
    id: 'accelerated-dragon', name: 'Accelerated Dragon', eco: 'B34–B39', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Sicilian_Defence,_Accelerated_Dragon',
    tier: 'next',
    levels: ['amateur', 'intermediate'],
    levelNote: 'A Sicilian with a fixed set-up (...g6, ...Bg7) and much less theory than the Najdorf or the main Dragon.',
    description: 'Fianchetto before ...d6, so you can often break with ...d5 in one move and avoid the Yugoslav Attack.',
    lines: [
      { name: 'Maroczy Bind 5.c4', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Bg7 Be3 Nf6 Nc3 O-O Be2 d6 O-O Bd7 Qd2 Nxd4 Bxd4 Bc6 f3 a5 b3 Nd7 Be3 Nc5' },
      { name: '5.Nc3 with Bc4', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6 f3 Bd7 Qd2 Nxd4 Bxd4 b5' },
      { name: '5.Nxc6', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nxc6 bxc6 Qd4 Nf6 e5 Nd5 e6 f6 exd7+ Bxd7' },
      { name: 'vs Smith-Morra', moves: 'e4 c5 d4 cxd4 c3 Nf6 e5 Nd5 Nf3 Nc6 cxd4 d6 Bc4 Nb6 Bb5 dxe5 Nxe5 Bd7' },
      { name: 'vs Grand Prix', moves: 'e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7 Bb5 Nd4 O-O a6 Bd3 e6' },
      { name: 'vs Rossolimo 3.Bb5', moves: 'e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7 Re1 e5 Bxc6 dxc6 d3 Qe7 a4 Nf6' },
      { name: 'vs Alapin 3.c3', moves: 'e4 c5 Nf3 Nc6 c3 Nf6 e5 Nd5 d4 cxd4 cxd4 d6 Bc4 Nb6 Bb5 dxe5 Nxe5 Bd7' },
    ],
  },
  {
    id: 'sicilian-dragon', name: 'Sicilian Dragon', eco: 'B70–B79', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Sicilian_Defence,_Dragon_Variation',
    tier: 'master',
    levels: ['intermediate', 'advanced'],
    levelNote: 'Opposite-side castling races where one tempo decides the game: you need to know the Yugoslav Attack well.',
    description: '...g6 and ...Bg7: the Dragon bishop rakes the long diagonal while you storm White\'s queenside king.',
    lines: [
      { name: 'Yugoslav 9.Bc4 (Soltis)', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 Kb1 Re8 h4 h5' },
      { name: 'Yugoslav 9.O-O-O d5', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O d5 exd5 Nxd5 Nxc6 bxc6 Bd4 Bxd4 Qxd4 Qb6' },
      { name: 'Yugoslav 9.g4', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 g4 Be6 O-O-O Nxd4 Bxd4 Qa5 a3 Rab8 h4 b5' },
      { name: 'Classical 6.Be2', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be2 Bg7 O-O O-O Be3 Nc6 Nb3 Be6 f4 Qc8' },
      { name: 'Levenfish 6.f4', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 f4 Nbd7 Nf3 Bg7 Bd3 O-O O-O Nc5' },
      { name: 'Fianchetto 6.g3', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 g3 Nc6 Nde2 Bg7 Bg2 O-O O-O Rb8' },
    ],
  },

  {
    id: 'french', name: 'French Defence', eco: 'C00–C19', side: 'b',
    source: 'https://en.wikipedia.org/wiki/French_Defence',
    tier: 'next',
    levels: ['amateur', 'intermediate'],
    levelNote: 'Solid, with clear pawn-break plans (...c5, ...f6), but the light-squared bishop needs care.',
    description: 'Solid and counter-attacking: ...e6 and ...d5, then strike back with ...c5 and ...f6.',
    lines: [
      { name: 'Advance Variation', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2 Na5 Be2 Bd7 O-O Ne7 Rb1 Qc7 Re1 Nc8 Nf1 Nb6 Bf4 h6' },
      { name: 'Winawer', moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8 Qxh7 cxd4 Ne2 Nbc6 f4 Bd7 Qd3 dxc3 Qxc3 Nf5 Rb1 d4 Qd3 O-O-O Rg1 Na5 g4 Ba4' },
      { name: 'Exchange Variation', moves: 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O Bg5 Bg4 Nbd2 Nbd7 c3 c6 Qc2 Qc7 Rfe1 Rfe8 Bh4 Bh5 Bg3 Bg6' },
      { name: 'Tarrasch 3.Nd2', moves: 'e4 e6 d4 d5 Nd2 c5 exd5 Qxd5 Ngf3 cxd4 Bc4 Qd6 O-O Nf6 Nb3 Nc6 Nbxd4 Nxd4 Nxd4 a6 Re1 Qc7 Bb3 Bd6 Nf5 Bxh2+ Kh1 O-O Nxg7 Rd8 Qf3 Kxg7 Bh6+ Kg6 c3 Nh5 Bc1 Bf4 g4 Ng3+' },
      { name: 'Classical 4.Bg5', moves: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Qd2 Nc6 dxc5 Nxc5 O-O-O a6 Bd3 b5' },
      { name: 'Steinitz 4.e5', moves: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3 cxd4 Nxd4 Bc5 Qd2 O-O O-O-O a6 Nb3 Bb4 Bd3 b5 g4 Bb7 Rhg1 Rc8' },
      { name: 'Advance 5...Bd7', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 Na3 cxd4 cxd4 Nf5 Nc2 Qb6 O-O Rc8 Kh1 Na5 g4 Ne7' },
      { name: 'Exchange with 4.c4', moves: 'e4 e6 d4 d5 exd5 exd5 c4 Nf6 Nc3 Bb4 Bd3 O-O Ne2 dxc4 Bxc4 Nbd7 O-O Nb6 Bb3 c6' },
      { name: 'vs King\'s Indian Attack', moves: 'e4 e6 d3 d5 Nd2 Nf6 Ngf3 c5 g3 Nc6 Bg2 Be7 O-O O-O Re1 b5 e5 Nd7 Nf1 a5 h4 b4 N1h2 a4 a3 bxa3 bxa3 Ba6' },
    ],
  },
  {
    id: 'caro-kann', name: 'Caro-Kann Defence', eco: 'B10–B19', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Caro%E2%80%93Kann_Defence',
    tier: 'first',
    levels: ['beginner', 'amateur', 'intermediate'],
    levelNote: 'Safe and sound with few early traps. A reliable defence at every level.',
    description: 'Rock-solid: ...c6 and ...d5 with a healthy pawn structure and the light bishop outside the chain.',
    lines: [
      { name: 'Advance Variation', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6 c3 cxd4 cxd4 Nge7 Nc3 Bg4 Nh4 Bxe2 Nxe2 Ng6 Nf3 Be7' },
      { name: 'Classical', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6 Bd2 Ngf6 O-O-O Be7 Kb1 O-O Ne4 Nxe4 Qxe4 Nf6 Qe2 Qd5 Ne5 Qe4 Qxe4 Nxe4 Be1 Rfd8 f3 Nf6' },
      { name: 'Exchange Variation', moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7 Nd2 e6 Ngf3 Bd6 Bxd6 Qxd6 O-O O-O Rfe1 Qc7' },
      { name: 'Panov Attack', moves: 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1 Bf6 Be4 Nce7 Qd3 g6 Bh6 Bg7 Bxg7 Kxg7' },
      { name: 'Two Knights', moves: 'e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6 d3 Nf6 Be2 Nbd7' },
      { name: 'Fantasy Variation', moves: 'e4 c6 d4 d5 f3 e6 Nc3 Bb4 Bf4 Ne7 Qd3 b6 Ne2 Ba6 Qe3 O-O O-O-O c5 a3 Bxc3' },
      { name: 'Advance 4.h4', moves: 'e4 c6 d4 d5 e5 Bf5 h4 h5 c4 e6 Nc3 Ne7 Nge2 Nd7 Ng3 Bg6 Bg5 Qb6 Rc1 Qxb2' },
      { name: 'Advance 4.Nc3 & g4', moves: 'e4 c6 d4 d5 e5 Bf5 Nc3 e6 g4 Bg6 Nge2 c5 h4 h5 Nf4 Bh7 Nxh5 Nc6 dxc5 Bxc5 Bb5 Qc7 Bxc6+ Qxc6 Qf3 O-O-O Nxg7 Ne7 Bg5 d4 Qxc6+ Nxc6' },
      { name: 'vs King\'s Indian Attack', moves: 'e4 c6 d3 d5 Nd2 e5 Ngf3 Bd6 g3 Nf6 Bg2 O-O O-O Re8 Re1 Nbd7 c3 a5' },
    ],
  },
  {
    id: 'scandinavian', name: 'Scandinavian Defence', eco: 'B01', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Scandinavian_Defense',
    tier: 'first',
    levels: ['beginner', 'amateur'],
    levelNote: 'Forces the game onto your terms from move one, with simple development plans.',
    description: 'Challenge e4 immediately with ...d5. Simple plans and easy development.',
    lines: [
      { name: '3...Qa5 Main Line', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6 Nd5 Qd8 Nxf6+ gxf6 Bb3 Nd7 Qe2 Qc7 Nh4 Bg6 O-O-O O-O-O g3 Bd6 Nxg6 hxg6' },
      { name: '3...Qd6', moves: 'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6 Be2 Nc6 O-O Bf5' },
      { name: '3.Nf3 – long castle', moves: 'e4 d5 exd5 Qxd5 Nf3 Bg4 Be2 Nc6 d4 O-O-O c4 Qf5 Be3 Bxf3 Bxf3 Nxd4 Bxd4 Qe6+ Be2 Qe4 O-O Qxd4 Qa4 e6' },
      { name: '3.d4', moves: 'e4 d5 exd5 Qxd5 d4 Nf6 Nf3 Bf5 c4 Qa5+ Nc3 e6' },
      { name: 'vs 2.e5', moves: 'e4 d5 e5 c5 Nf3 Nc6 d4 Bg4' },
      { name: 'vs 2.Nc3', moves: 'e4 d5 Nc3 d4 Nce2 e5 Ng3 Be6 Nf3 f6 Bb5+ c6 Ba4 Na6' },
    ],
  },
  {
    id: 'open-game-black', name: '1...e5 Open Games', eco: 'C40–C59', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Open_Game',
    tier: 'first',
    levels: ['beginner', 'amateur', 'intermediate'],
    levelNote: 'The classical answer to 1.e4. It teaches open-game principles you will use forever.',
    description: 'Meet 1.e4 with the classical 1...e5 – correct answers to the Italian, Scotch and friends.',
    lines: [
      { name: 'vs Italian (Pianissimo)', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O a6 a4 O-O h3 Ba7 Re1 h6 Nbd2 Re8 b4 Be6 Bxe6 Rxe6 Qc2 Qd7 Nf1 d5 Be3 Bxe3 Nxe3 Ne7 a5 Re8 Rab1 Nc6' },
      { name: 'vs Italian c3 d4', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5 Qb3 Na5 Qa4+ Nc6' },
      { name: 'vs Scotch', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6 b3 g6 f4 d6 Qf2 Nf6 Be2 dxe5 O-O Ne4 Qe1 O-O-O' },
      { name: 'vs Ruy López (Berlin)', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ke8 h3 h5 Bf4 Be7 Rad1 Be6 Ng5 Rh6 Rfe1 Bb4 g4 hxg4 hxg4 Ne7 Nxe6 Rxe6 Re3 Ng6 Bg3 Bxc3' },
      { name: 'vs Ponziani', moves: 'e4 e5 Nf3 Nc6 c3 Nf6 d4 Nxe4 d5 Ne7 Nxe5 Ng6 Nxg6 hxg6' },
      { name: 'vs Four Knights', moves: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Nd4 Ba4 Bc5 Nxe5 O-O Nd3 Bb6 e5 Ne8 Nd5 d6 Ne3 c5 c3 Nf5' },
      { name: 'vs Scotch Gambit', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bc5 c3 Nf6 e5 d5 Bb5 Ne4 cxd4 Bb6 Nc3 O-O Be3 Bg4 h3 Bh5 Qc2 Bg6 Qb3 Ne7 O-O c6 Bd3 Nd2 Nxd2 Bxd3 Rfe1 Bg6 Na4 Nf5' },
      { name: 'vs King\'s Gambit', moves: 'e4 e5 f4 exf4 Nf3 d5 exd5 Nf6 Bc4 Nxd5 O-O Be6 Bb3 Be7 c4 Nb6' },
      { name: 'vs Vienna', moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 Qe2 Nxc3 dxc3 c5 Bf4 Nc6 O-O-O Be6 h4 h6' },
      { name: 'vs Bishop\'s Opening', moves: 'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3 Bd6 Nc3 dxe4 Ng5 O-O Ncxe4 Nxe4 Nxe4 Bf5 Qf3 Bxe4 dxe4 Nd7 c3 a5' },
    ],
  },
  {
    id: 'kings-indian', name: "King's Indian Defence", eco: 'E60–E99', side: 'b',
    source: 'https://en.wikipedia.org/wiki/King%27s_Indian_Defence',
    tier: 'master',
    levels: ['intermediate', 'advanced'],
    levelNote: 'You give White the centre on purpose, so you must know exactly when and how to strike back.',
    description: 'Let White take the centre, then hit back with ...e5 and a kingside pawn storm.',
    lines: [
      { name: 'Classical Mar del Plata', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5 f3 f4 Bf2 g5 Rc1 Ng6 c5 Nxc5 b4 Na6 Nd3 h5 Nb5 b6 Be1 Qd7 a4 Bf6' },
      { name: 'Sämisch', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5 Qd2 f5 O-O-O Nd7' },
      { name: 'Fianchetto', moves: 'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O Nbd7 Nc3 e5 e4 c6 h3 Qb6 Re1 exd4 Nxd4 Re8 Nc2 Nc5 b4 Ne6 Be3 Qc7' },
      { name: 'Four Pawns Attack', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4 O-O Nf3 c5 d5 e6 Be2 exd5 cxd5 Bg4 O-O Nbd7 h3 Bxf3 Bxf3 Re8 g4 h6' },
      { name: 'Averbakh', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5 c5 d5 h6 Be3 e6 Qd2 exd5 exd5 Kh7 h3 Re8 Bd3 b5' },
      { name: 'Exchange Variation', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 dxe5 dxe5 Qxd8 Rxd8 Bg5 Re8 Nd5 Nxd5 cxd5 c6 Bc4 cxd5 Bxd5 Nd7 Nd2 Nc5 O-O-O Be6 Bxe6 Nxe6' },
      { name: 'vs London System', moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 Nbd7 O-O Qe8 c4 e5 Bh2 Ne4 Nbd2 Nxd2 Qxd2 e4' },
      { name: 'vs Trompowsky', moves: 'd4 Nf6 Bg5 Ne4 Bf4 c5 f3 Qa5+ c3 Nf6 d5 Qb6 Bc1 e6 e4 exd5 exd5 Bd6 Na3 O-O Bd3 Re8+ Ne2 Bf8 Nc4 Qd8 Ne3 d6' },
    ],
  },
  {
    id: 'nimzo', name: 'Nimzo-Indian Defence', eco: 'E20–E59', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Nimzo-Indian_Defence',
    tier: 'master',
    levels: ['intermediate', 'advanced'],
    levelNote: 'Subtle positional ideas: bishop pair vs. structure and control of e4.',
    description: 'Pin the c3-knight with ...Bb4 and fight for e4 with pieces rather than pawns.',
    lines: [
      { name: 'Classical 4.Qc2', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 f3 h6 Bh4 d5 e3 Nbd7 cxd5 Nxd5 Bxd8 Nxc3 Bh4 Nd5 Bf2 c5 e4 Ne7 Ne2 f5 exf5 Nxf5 dxc5 Nxc5 Nc3 Rad8 Rd1 Rxd1+' },
      { name: 'Rubinstein 4.e3', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7 Bb2 e5 h3 Bf5 Qe2 Rad8 Bb5 e4 Nd2 Bg6' },
      { name: 'Kasparov 4.Nf3', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5 g3 cxd4 Nxd4 O-O Bg2 d5 cxd5 Nxd5 Qb3 Nc6 Nxc6 bxc6 O-O Qa5 Bd2 Bxc3 bxc3 Ba6 Rfd1 Qc5 e4 Bc4 Qa4 Nb6 Qb4 Qh5 Be3 Be2 Rd2 Rab8 Bxb6 axb6' },
      { name: 'Sämisch 4.a3', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3 c5 e3 Nc6 Bd3 O-O Ne2 b6 e4 Ne8 O-O Ba6 f4 f5 exf5 exf5 dxc5 bxc5 Be3 d6 Ng3 g6' },
      { name: '4.f3', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 f3 d5 a3 Be7 e4 dxe4 fxe4 e5 d5 Bc5 Nf3 Bg4 h3 Bxf3 Qxf3 Nbd7' },
      { name: 'Leningrad 4.Bg5', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Bg5 h6 Bh4 c5 d5 d6 e3 Bxc3+ bxc3 e5 Qc2 Qe7 Nf3 Nbd7 Nd2 g5 Bg3 Nh5 Bd3 Ndf6' },
      { name: 'vs 3.Nf3 (Queen\'s Indian)', moves: 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 Bc3 d5 Ne5 Nfd7 Nxd7 Nxd7 Nd2 O-O O-O Rc8 e4 b5 Re1 dxc4 bxc4 bxc4 Qa4 Bb5 Qc2 Re8 a4 Ba6 Rad1 Bf8 Nf1 Rb8' },
      { name: 'vs Catalan 3.g3', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6 a4 Bd7 Qxc4 Bc6 Bg5 Bd5 Qc2 Be4 Qc1 h6 Bxf6 Bxf6 Rd1 a5 Nbd2 Bxf3 Bxf3 c6 e3 Na6' },
    ],
  },
  {
    id: 'slav', name: 'Slav Defence', eco: 'D10–D19', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Slav_Defense',
    tier: 'next',
    levels: ['amateur', 'intermediate', 'advanced'],
    levelNote: 'Solid like the Queen\'s Gambit Declined, but your light-squared bishop gets out before ...e6, so there is no problem piece.',
    description: '...d5 and ...c6 against 1.d4: a rock-solid centre with the c8 bishop developed to f5 or g4.',
    lines: [
      { name: 'Main line 5.a4 Bf5', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O Nbd7 Qe2 Bg6 e4 O-O Bd3 Bh5' },
      { name: '4.e3 Bf5', moves: 'd4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Nc3 e6 Nh4 Bg6 Nxg6 hxg6 Bd3 Nbd7 O-O Bd6 h3 dxc4 Bxc4 O-O' },
      { name: 'Exchange Slav', moves: 'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6 e3 Bf5 Nf3 e6 Bb5 Nd7 Qa4 Rc8 O-O a6 Bxc6 Rxc6' },
      { name: '4.Qc2', moves: 'd4 d5 c4 c6 Nf3 Nf6 Qc2 dxc4 Qxc4 Bf5 Nc3 e6 g3 Nbd7 Bg2 Be7 O-O O-O' },
      { name: '4.g3', moves: 'd4 d5 c4 c6 Nf3 Nf6 g3 Bf5 Bg2 e6 O-O Nbd7 cxd5 cxd5 Nc3 Be7' },
      { name: 'vs London', moves: 'd4 d5 Bf4 Nf6 e3 c6 Nf3 Bf5 c4 e6 Nc3 Nbd7 Qb3 Qb6 c5 Qxb3 axb3 Be7 Be2 O-O' },
    ],
  },
  {
    id: 'qgd', name: "Queen's Gambit Declined", eco: 'D30–D69', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Queen%27s_Gambit_Declined',
    tier: 'next',
    levels: ['amateur', 'intermediate', 'advanced'],
    levelNote: 'The classical answer to 1.d4: hold d5 with ...e6, develop and castle. Sound at every level, from club games to world championships.',
    description: '...d5 and ...e6: a solid centre, easy development and the freeing breaks ...c5 and ...e5.',
    lines: [
      { name: 'Tartakower 5.Bg5', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 Be2 Bb7 Bxf6 Bxf6 cxd5 exd5 b4 c6 O-O a5 b5 c5' },
      { name: '5.Bf4', moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4 O-O e3 c5 dxc5 Bxc5 Qc2 Nc6 a3 Qa5 Rd1 Re8' },
      { name: 'Exchange Variation', moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nge2 Re8 O-O Nf8' },
      { name: 'vs Catalan', moves: 'd4 d5 c4 e6 Nf3 Nf6 g3 Be7 Bg2 O-O O-O dxc4 Qc2 a6 a4 Bd7 Qxc4 Bc6' },
      { name: 'vs London', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3 b6' },
      { name: 'vs Colle', moves: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6 Bb2 O-O Nbd2 b6' },
      { name: 'Trap – Elephant Trap', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8', keep: true },
    ],
  },
  {
    id: 'dutch-stonewall', name: 'Stonewall Dutch', eco: 'A84–A95', side: 'b',
    source: 'https://en.wikipedia.org/wiki/Dutch_Defence#Stonewall_Variation',
    tier: 'next',
    levels: ['amateur', 'intermediate'],
    levelNote: 'The same pawn wall (c6, d5, e6, f5) against almost everything, with a clear plan: knight to e4 and a kingside attack.',
    description: '1...f5 and the Stonewall: a fixed set-up, a strong outpost on e4 and attacking chances against White\'s king.',
    lines: [
      { name: 'Main line 7.b3', moves: 'd4 f5 c4 Nf6 g3 e6 Bg2 d5 Nf3 c6 O-O Bd6 b3 Qe7 Ne5 O-O Bb2 Bd7 Nd2 Be8' },
      { name: '7.Bf4', moves: 'd4 f5 c4 Nf6 g3 e6 Bg2 d5 Nf3 c6 O-O Bd6 Bf4 Bxf4 gxf4 O-O e3 Ne4' },
      { name: 'vs 2.Nc3 & Bg5', moves: 'd4 f5 Nc3 Nf6 Bg5 d5 Bxf6 exf6 e3 c6 Bd3 g6' },
      { name: 'vs Staunton Gambit', moves: 'd4 f5 e4 fxe4 Nc3 Nf6 Bg5 Nc6 d5 Ne5 Qd4 Nf7 Bxf6 exf6 Nxe4 f5' },
      { name: 'vs London', moves: 'd4 f5 Bf4 Nf6 e3 e6 Nf3 d5 c4 c6 Nc3 Bd6' },
    ],
  },
];

export function getOpening(id) {
  return OPENINGS.find((o) => o.id === id);
}

export function lineMoves(line) {
  return line.moves.trim().split(/\s+/);
}
