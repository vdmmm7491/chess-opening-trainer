// Which moves of the Punish drills (js/punish.js) are asked in the quiz, keyed by opening id and
// drill name. The numbers are indexes into the drill's `punish` moves (0 = the first punishing
// move, 2 = your next one...). The quiz gives one try, so a move is only listed when it is
// Stockfish's first choice at depth 15+, at least half a pawn better than any other move, and you
// end up at least half a pawn ahead. Recaptures are left out.
export const QUIZ_PUNISH = {
  'italian': {
    '4...h6? ignores f7': [0, 2],
    '5...Nxd5? Fried Liver': [0, 2, 4],
    '5...Bh5? Légal trap': [0, 2, 4],
    '4...Na5? drops e5': [0],
    '5...O-O? ignores d4': [0],
    '5...d5? one break too many': [0],
    '6...f6? Evans Gambit': [2, 4],
    '8...Na5? Giuoco Piano': [6],
  },
  'ruy-lopez': {
    '7...O-O? Tarrasch trap': [2, 4, 6],
    '4...Ng4? fishing pole': [2, 4],
    '7...Qd5? Schliemann': [0, 2],
    '6...Bd7? Schliemann': [0, 2, 4, 6],
    '5...Nf6? Exchange, e5 drops': [0],
    '5...d6? pinned knight': [0, 2],
  },
  'scotch': {
    '7...Qxg2? greedy queen': [2, 4],
    '5...Be7? slow queen': [0, 2],
    '5...Nf6? queen runs out of squares': [2],
    '8...Nf6? c7 fork': [0, 2],
  },
  'queens-gambit': {
    '4...Ne4?? drops the queen': [0],
    '3...b5? holding c4': [2, 4],
    '5...b5? Slav': [0],
    '5...c4? Tarrasch': [0, 2],
    '10...Nxc3? the in-between move': [0, 2],
  },
  'london': {
    '3...Nh5?? hangs': [0],
    '4...Qxb2? pawn grab': [0, 4],
    '6...c4? forgets b7': [0, 2],
    '6...Bg4?? h3 covers it': [0],
    '6...Bd6? b7 hangs': [0, 2],
    '6...e5? too early': [0, 4],
  },
  'english': {
    '4...Ne4? loose knight': [0],
    '6...Bg4? fake pin': [0],
    '6...Bb4? forgets e5': [0],
    '3...Nd7? blocks the queen': [0],
    '3...d5? e5 left behind': [0, 2],
  },
  'vienna': {
    '4...Nf6?? Qxf7#': [0],
    '6...Nxb5?? mate': [0],
    '4...Ng4?? free knight': [0],
    '4...Nf6? g7 hangs': [0],
    '3...Qf6? early queen': [0],
    '4...dxe4? knight hangs': [0],
    '7...Be6? e4 is loose': [0],
  },
  'sicilian-najdorf': {
    '7.Nf5? ...d5!': [0, 2],
    '9.h3?? Siberian trap': [0, 2],
    '7.Bc4? knight on d4': [0],
    '4.O-O? Bb5 hangs': [0],
    '9.Bf4? ...e5 fork': [0],
  },
  'french': {
    '6.Be3? b2 hangs': [0, 2],
    '8.Nc3? d4 falls': [0],
    '7.Nxd4? e5 drops': [0],
    '10.Nf3? Poisoned Pawn': [0, 2],
    '7.f5? drops the centre': [0],
  },
  'caro-kann': {
    '7.Ne5? ...Qa5+ fork': [0, 2],
    '8.Nf3? walks into the pin': [0],
    '8.g4? loose pawn': [0],
  },
  'scandinavian': {
    '8.Ne5? d4 drops': [0, 2],
    '7.Be2? d4 drops': [0, 2],
    '5.Bf4?? into the queen': [0],
    '4.Bd3? g2 hangs': [0],
    '5.Bg5?? along the 5th rank': [0],
    '4.d3? undermines e5': [2],
  },
  'open-game-black': {
    '4.Ng5?? Qxg5': [0],
    '6.Nc3?? Qxf2#': [0],
    '6.Bd3?? blocks the queen': [0],
    '6.Nxe5? Berlin': [0, 2],
    '8.Bxf4? King’s Gambit': [0, 2],
    '5.g4? Scholar’s mate try': [0, 2],
    '5.Qb3? Scholar’s mate try': [0, 2, 4],
    '6.Nxe5? Berlin, Bb5 hangs': [0],
    '6.Be3? Berlin, Bb5 hangs': [0],
    '7.Be2? Scotch, e5 hangs': [0],
  },
  'kings-indian': {
    '8.cxd6? Four Pawns': [0],
    '9.Nxd5? e4 is loose': [0],
    '9.Na4? e4 is loose': [0],
  },
  'nimzo': {
    '7.Nd2? Kasparov line': [0],
    '5.Bd2?? not taking back': [0, 2],
    '6.Bg2? c3 knight attacked': [0],
    '6.Bf4? c3 knight attacked': [0],
    '8.Be3? ...Ng4': [0],
    '8.Bg5? d4 drops': [0],
    '10.Nc2? queen and bishop clash': [0],
  },
  'alien-gambit': {
    '9...Bd7? king walk': [0],
    '6...cxd4? forgets f7': [0],
    '8...e5? drops a pawn': [0],
  },
  'alapin-sicilian': {
    '3...Ng4? into the queen': [0],
    '4...Bg4? hangs the bishop': [0],
    '8...Nf6? ignores h3': [0],
    '6...g6? leaves d5 loose': [0],
  },
  'advance-french-caro': {
    '5...Nf6? pawn takes': [0],
  },
  'catalan': {
    '6...Nbd7? loose bishop': [0],
    '7...e5? opens the d-file': [0, 2],
  },
  'sicilian-classical': {
    '5.Bd3? blocks the queen': [0],
    '5.Nd2? same idea': [0],
  },
  'sicilian-dragon': {
    '7.Nf5? gxf5': [0],
  },
  'slav': {
    '7.Ne4? Nxe4': [0],
  },
  'qgd': {
    '7.Nxd5? Qxd5!': [2],
  },
  'dutch-stonewall': {
    '8.Ba3? Bxa3': [0],
  },
};
