// Opening repertoire data.
// side:      the colour YOU play when training this opening ('w' or 'b').
// levels:    which rating bands the opening suits – any of the LEVELS keys below.
// levelNote: one sentence on why it suits those players (shown on the card).
// Each line is a space-separated list of SAN moves starting from the initial position.
// To add an opening, append an object here – ids must be unique and never change
// (progress is stored by id + line index). Check your edits with tools/validate.html.

/** Rating bands, in order. `max` is exclusive. */
export const LEVELS = {
  beginner: { name: 'Beginner', range: 'Under 1000', min: 0, max: 1000, color: '#81b64c' },
  intermediate: { name: 'Intermediate', range: '1000–1600', min: 1000, max: 1600, color: '#48b4f0' },
  advanced: { name: 'Advanced', range: '1600–2000', min: 1600, max: 2000, color: '#f7a440' },
  expert: { name: 'Expert', range: '2000+', min: 2000, max: Infinity, color: '#e8615a' },
};

/** The level key for a rating number, e.g. 850 -> 'beginner'. */
export function levelForRating(rating) {
  return Object.keys(LEVELS).find((k) => rating >= LEVELS[k].min && rating < LEVELS[k].max) || 'beginner';
}

export const OPENINGS = [
  // ---------------- White ----------------
  {
    id: 'italian', name: 'Italian Game', eco: 'C50–C54', side: 'w',
    levels: ['beginner', 'intermediate', 'advanced'],
    levelNote: 'Teaches the basics (fast development, castling, centre control) and stays playable all the way up.',
    description: 'Develop fast, aim the bishop at f7 and build a slow, solid centre with c3 and d3/d4.',
    lines: [
      { name: 'Giuoco Pianissimo', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3' },
      { name: 'Two Knights – d3', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3 Na5 Bb5 a6 Ba4 b5 Bc2' },
      { name: 'Giuoco Piano – c3 d4', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5 Qb3' },
    ],
  },
  {
    id: 'ruy-lopez', name: 'Ruy López', eco: 'C60–C99', side: 'w',
    levels: ['intermediate', 'advanced', 'expert'],
    levelNote: 'Deep theory and slow manoeuvring plans pay off once you understand pawn structures.',
    description: 'The Spanish: pressure the e5 defender with Bb5 and play for a long-term central advantage.',
    lines: [
      { name: 'Closed Morphy', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3' },
      { name: 'Berlin Defence', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3' },
      { name: 'Exchange Variation', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1' },
    ],
  },
  {
    id: 'scotch', name: 'Scotch Game', eco: 'C44–C45', side: 'w',
    levels: ['beginner', 'intermediate', 'advanced'],
    levelNote: 'Open, direct positions with clear plans and little theory to memorise.',
    description: 'Open the centre immediately with d4 for active, direct piece play.',
    lines: [
      { name: 'Mieses Variation', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6 b3' },
      { name: 'Classical 4...Bc5', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nxc6 Qf6 Qd2 dxc6 Nc3 Be6 Na4' },
    ],
  },
  {
    id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06–D69', side: 'w',
    levels: ['intermediate', 'advanced', 'expert'],
    levelNote: 'Positional and principled. Best once you are comfortable with slower, strategic games.',
    description: 'Offer the c-pawn to deflect Black from the centre. Positional, principled, timeless.',
    lines: [
      { name: 'QGD Orthodox', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3' },
      { name: 'Queen\'s Gambit Accepted', moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 dxc5 Qxd1 Rxd1 Bxc5 a3' },
      { name: 'Slav Defence', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O' },
    ],
  },
  {
    id: 'london', name: 'London System', eco: 'D02 / A48', side: 'w',
    levels: ['beginner', 'intermediate'],
    levelNote: 'The same setup against almost everything, so there is very little to memorise.',
    description: 'A reliable setup: d4, Bf4, e3, Nf3, c3 and Bd3 against almost anything.',
    lines: [
      { name: 'vs ...d5 & ...c5', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3' },
      { name: 'vs King\'s Indian setup', moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 c5 c3 Nc6 O-O' },
    ],
  },
  {
    id: 'english', name: 'English Opening', eco: 'A10–A39', side: 'w',
    levels: ['advanced', 'expert'],
    levelNote: 'Flexible and transpositional. You need a feel for structures more than memorised lines.',
    description: 'Flexible flank opening – control d5 with c4, fianchetto and play a reversed Sicilian.',
    lines: [
      { name: 'Reversed Sicilian', moves: 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O Be7 d3' },
      { name: 'Symmetrical', moves: 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 e6 O-O Nge7 d3 O-O Rb1' },
    ],
  },
  {
    id: 'vienna', name: 'Vienna Game', eco: 'C25–C29', side: 'w',
    levels: ['beginner', 'intermediate'],
    levelNote: 'Aggressive, full of traps, and opponents at club level often go wrong early.',
    description: 'Nc3 first, then an early f4 – an aggressive weapon against 1...e5.',
    lines: [
      { name: 'Vienna Gambit', moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4 O-O Bd3 f5 exf6 Bxf6 O-O' },
      { name: 'vs 2...Nc6', moves: 'e4 e5 Nc3 Nc6 Bc4 Nf6 d3 Bb4 Bg5 h6 Bxf6 Bxc3+ bxc3 Qxf6 Ne2' },
    ],
  },

  // ---------------- Black ----------------
  {
    id: 'sicilian-najdorf', name: 'Sicilian Najdorf', eco: 'B90–B99', side: 'b',
    levels: ['advanced', 'expert'],
    levelNote: 'Very sharp with huge amounts of theory. One wrong move can lose on the spot.',
    description: 'The sharpest answer to 1.e4. ...a6 keeps options open for ...e5 or ...e6 and queenside play.',
    lines: [
      { name: 'English Attack', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7' },
      { name: '6.Bg5', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7' },
      { name: '6.Be2 Classical', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6' },
      { name: 'vs Alapin 2.c3', moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4 Nb6 Bb5 dxe5' },
    ],
  },
  {
    id: 'french', name: 'French Defence', eco: 'C00–C19', side: 'b',
    levels: ['intermediate', 'advanced'],
    levelNote: 'Solid, with clear pawn-break plans (...c5, ...f6), but the light-squared bishop needs care.',
    description: 'Solid and counter-attacking: ...e6 and ...d5, then strike back with ...c5 and ...f6.',
    lines: [
      { name: 'Advance Variation', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2 Na5' },
      { name: 'Winawer', moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7' },
      { name: 'Exchange Variation', moves: 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O Bg5 Bg4' },
      { name: 'Tarrasch 3.Nd2', moves: 'e4 e6 d4 d5 Nd2 c5 exd5 Qxd5 Ngf3 cxd4 Bc4 Qd6 O-O Nf6' },
    ],
  },
  {
    id: 'caro-kann', name: 'Caro-Kann Defence', eco: 'B10–B19', side: 'b',
    levels: ['beginner', 'intermediate', 'advanced'],
    levelNote: 'Safe and sound with few early traps. A reliable defence at every level.',
    description: 'Rock-solid: ...c6 and ...d5 with a healthy pawn structure and the light bishop outside the chain.',
    lines: [
      { name: 'Advance Variation', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6 c3 cxd4 cxd4 Nge7' },
      { name: 'Classical', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6' },
      { name: 'Exchange Variation', moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7' },
    ],
  },
  {
    id: 'scandinavian', name: 'Scandinavian Defence', eco: 'B01', side: 'b',
    levels: ['beginner', 'intermediate'],
    levelNote: 'Forces the game onto your terms from move one, with simple development plans.',
    description: 'Challenge e4 immediately with ...d5. Simple plans and easy development.',
    lines: [
      { name: '3...Qa5 Main Line', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6' },
      { name: '3...Qd6', moves: 'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6 Be2 Nc6 O-O Bf5' },
    ],
  },
  {
    id: 'open-game-black', name: '1...e5 Open Games', eco: 'C40–C59', side: 'b',
    levels: ['beginner', 'intermediate', 'advanced'],
    levelNote: 'The classical answer to 1.e4. It teaches open-game principles you will use forever.',
    description: 'Meet 1.e4 with the classical 1...e5 – correct answers to the Italian, Scotch and friends.',
    lines: [
      { name: 'vs Italian (Pianissimo)', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O a6 a4 O-O' },
      { name: 'vs Italian c3 d4', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5' },
      { name: 'vs Scotch', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5' },
      { name: 'vs Ruy López (Berlin)', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8' },
    ],
  },
  {
    id: 'kings-indian', name: "King's Indian Defence", eco: 'E60–E99', side: 'b',
    levels: ['advanced', 'expert'],
    levelNote: 'You give White the centre on purpose, so you must know exactly when and how to strike back.',
    description: 'Let White take the centre, then hit back with ...e5 and a kingside pawn storm.',
    lines: [
      { name: 'Classical Mar del Plata', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7' },
      { name: 'Sämisch', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5 Qd2 Qh4+ g3 Nxg3' },
      { name: 'Fianchetto', moves: 'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O Nbd7 Nc3 e5 e4 c6' },
    ],
  },
  {
    id: 'nimzo', name: 'Nimzo-Indian Defence', eco: 'E20–E59', side: 'b',
    levels: ['advanced', 'expert'],
    levelNote: 'Subtle positional ideas: bishop pair vs. structure and control of e4.',
    description: 'Pin the c3-knight with ...Bb4 and fight for e4 with pieces rather than pawns.',
    lines: [
      { name: 'Classical 4.Qc2', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 f3 h6 Bh4 d5' },
      { name: 'Rubinstein 4.e3', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7' },
    ],
  },
];

export function getOpening(id) {
  return OPENINGS.find((o) => o.id === id);
}

export function lineMoves(line) {
  return line.moves.trim().split(/\s+/);
}
