// "Punish" mode: common opponent mistakes in each opening and how to punish them.
// Keyed by opening id. Each entry:
//   name:    short label for the picker (keep it short: phones)
//   moves:   SAN from the start up to and including the opponent's mistake
//   punish:  your punishing moves, with the opponent's likely replies in between;
//            starts and ends with YOUR move
//   mistake: shown before you move: what's wrong with their move (don't give the answer away)
//   why:     shown once you've found it: why the punishment works
//   elo:     the rating band where this mistake is typical: the band's lower bound (a key of BANDS)
// Every line was checked with Stockfish. Check edits with tools/validate.html.

/** Rating bands for Punish mode. Fixed, so entries never need re-sorting. */
export const BANDS = [
  { min: 0, max: 500, label: '0–500' },
  { min: 500, max: 750, label: '500–750' },
  { min: 750, max: 1000, label: '750–1000' },
  { min: 1000, max: 1250, label: '1000–1250' },
  { min: 1250, max: 1500, label: '1250–1500' },
  { min: 1500, max: 1750, label: '1500–1750' },
  { min: 1750, max: 2000, label: '1750–2000' },
  { min: 2000, max: Infinity, label: '2000+' },
];

/** The band (its min) for a rating number, e.g. 820 -> 750. */
export function bandFor(rating) {
  const r = Number(rating) || 0;
  return [...BANDS].reverse().find((b) => r >= b.min).min;
}

export const PUNISH = {
  italian: [
    {
      name: '4...h6? ignores f7',
      elo: 500,
      moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 h6',
      punish: 'Nxf7 Qe7 Nxh8',
      mistake: 'Kicking the knight costs a move, and f7 is attacked twice (knight and bishop) while only the king defends it.',
      why: '5.Nxf7 forks the queen on d8 and the rook on h8. After 5...Qe7 6.Nxh8 you are a whole rook up.',
    },
    {
      name: '5...Nxd5? Fried Liver',
      elo: 750,
      moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5',
      punish: 'Nxf7 Kxf7 Qf3+ Ke6 Nc3',
      mistake: 'Taking back on d5 leaves that knight loose in front of your bishop, and f7 is still only guarded by the king. The book move is 5...Na5.',
      why: '6.Nxf7 (the Fried Liver) drags the king out. 7.Qf3+ hits the king and the d5 knight, and after 7...Ke6 8.Nc3 you pile up on the pinned knight while the black king is stuck in the middle.',
    },
    {
      name: '5...Bh5? Légal trap',
      elo: 750,
      moves: 'e4 e5 Nf3 Nc6 Bc4 d6 Nc3 Bg4 h3 Bh5',
      punish: 'Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
      mistake: 'The bishop keeps pinning your knight to your queen, but the pin is fake: you can break it with a tactic.',
      why: '6.Nxe5 offers your queen. 6...Bxd1?? 7.Bxf7+ Ke7 8.Nd5# is Légal\'s mate. If Black takes the knight instead, 6...Nxe5 7.Qxh5 Nxc4 8.Qb5+ and 9.Qxc4 leaves you a pawn up.',
    },
    {
      name: '4...Na5? drops e5',
      elo: 1000,
      moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Na5',
      punish: 'Nxe5 Nxc4 Nxc4',
      mistake: 'Chasing your bishop takes away the only piece that was defending the e5 pawn.',
      why: '5.Nxe5 grabs the pawn. After 5...Nxc4 6.Nxc4 you are a clean pawn up with a nice centre.',
    },
  ],

  'ruy-lopez': [
    {
      name: '7...O-O? Tarrasch trap',
      elo: 1250,
      moves: 'e4 e5 Nf3 Nc6 Bb5 d6 d4 Bd7 Nc3 Nf6 O-O Be7 Re1 O-O',
      punish: 'Bxc6 Bxc6 dxe5 dxe5 Qxd8 Raxd8 Nxe5',
      mistake: 'Castling looks natural, but e5 is short of defenders: once the c6 knight is gone, it falls.',
      why: 'Take on c6, trade on e5 and on d8, and 11.Nxe5 wins a pawn. If 11...Bxe4 12.Nxe4 Nxe4 13.Nd3 the knight on e4 is pinned on the e-file and in trouble.',
    },
    {
      name: '4...Ng4? fishing pole',
      elo: 1000,
      moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Ng4',
      punish: 'h3 Nf6 Bxc6 bxc6 Nxe5',
      mistake: 'The knight jumps forward hoping for 5.h3 h5 6.hxg4? hxg4, which opens the h-file against your king.',
      why: 'Kick it with 5.h3 but never take if Black plays ...h5. After 5...Nf6 6.Bxc6 bxc6 7.Nxe5 Black has wasted two moves and lost the e5 pawn.',
    },
    {
      name: '7...Qd5? Schliemann',
      elo: 1500,
      moves: 'e4 e5 Nf3 Nc6 Bb5 f5 Nc3 fxe4 Nxe4 d5 Nxe5 dxe4 Nxc6 Qd5',
      punish: 'c4 Qd6 Nxa7+ Bd7 Bxd7+ Qxd7 Qh5+',
      mistake: 'The queen attacks b5 and g2 at once, but it can be kicked with tempo. The book move is 7...Qg5.',
      why: '8.c4 chases the queen and keeps your bishop defended. After 8...Qd6 9.Nxa7+ wins a pawn with check, and after the bishop trade 11.Qh5+ keeps the black king on the run: you are two pawns up.',
    },
  ],

  scotch: [
    {
      name: '5...Bxf2+? desperado',
      elo: 500,
      moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nxc6 Bxf2+',
      punish: 'Kxf2 Qf6+ Qf3 Qxc6 Nc3',
      mistake: 'Black gives up the bishop for one pawn, hoping for a queen check and to win your c6 knight back.',
      why: 'Just take: 6.Kxf2. Block the check with 7.Qf3 (7.Kg1? leaves the king boxed in behind its rook). Black wins the c6 knight back, but you stay a piece for a pawn up.',
    },
    {
      name: '7...Qxg2? greedy queen',
      elo: 1000,
      moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4 Nc3 Bb4 Be2 Qxe4 Nb5 Qxg2',
      punish: 'Bf3 Qh3 Nxc7+ Kd8 Nxa8',
      mistake: 'The queen grabs a second pawn and hits your rook, but forgets your threat on c7.',
      why: '8.Bf3 saves the rook with tempo. After 8...Qh3 9.Nxc7+ forks king and rook, and 10.Nxa8 wins a whole rook.',
    },
  ],

  'queens-gambit': [
    {
      name: '4...Ne4?? drops the queen',
      elo: 500,
      moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Ne4',
      punish: 'Bxd8 Nxc3 bxc3',
      mistake: 'The knight jumps away and breaks the pin, but it was the only thing between your g5 bishop and the queen.',
      why: '5.Bxd8 wins the queen. Black gets a knight back at most: you are a queen for a minor piece up.',
    },
    {
      name: '4...Qxd5?? loose queen',
      elo: 0,
      moves: 'd4 d5 c4 e6 Nc3 c5 cxd5 Qxd5',
      punish: 'Nxd5',
      mistake: 'The queen takes back on d5, a square your c3 knight attacks.',
      why: '5.Nxd5 wins the queen for a knight. Before recapturing, always check what attacks the square.',
    },
    {
      name: '3...b5? holding c4',
      elo: 750,
      moves: 'd4 d5 c4 dxc4 e3 b5',
      punish: 'a4 c6 axb5 cxb5 Qf3',
      mistake: 'Black tries to keep the extra pawn with ...b5, but queenside pawns can be undermined.',
      why: '4.a4 c6 5.axb5 cxb5 6.Qf3 hits the a8 rook down the long diagonal. Blocking with 6...Nc6 loses the knight to 7.Qxc6+, so you win material.',
    },
    {
      name: '5...b5? Slav',
      elo: 1250,
      moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 b5',
      punish: 'axb5 cxb5 Nxb5',
      mistake: 'After a4, holding c4 with ...b5 fails: b5 is attacked twice and defended once.',
      why: '6.axb5 cxb5 7.Nxb5 wins the pawn back, and you keep a strong centre and pressure down the a-file.',
    },
    {
      name: '5...Bg4? Slav',
      elo: 1500,
      moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bg4',
      punish: 'Ne5 Bh5 f3 Nfd7 Nxc4',
      mistake: 'The bishop pins your knight, but it leaves the knight free to jump to e5 with tempo and win back c4.',
      why: '6.Ne5 hits the bishop and eyes c4. After 6...Bh5 7.f3 the bishop is shut out, and 8.Nxc4 regains the pawn with a big centre (e4 is next).',
    },
    {
      name: '5...c4? Tarrasch',
      elo: 1500,
      moves: 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 c4',
      punish: 'e4 Bb4 exd5 Bxc3+ bxc3 Qxd5 Be2',
      mistake: 'Grabbing space with ...c4 releases the pressure on d4, and the isolated d5 pawn has no pawn support left.',
      why: '6.e4 breaks open the centre at once. After 6...Bb4 7.exd5 Bxc3+ 8.bxc3 Qxd5 9.Be2 Black\'s king is still in the middle and you are well ahead in development.',
    },
  ],

  london: [
    {
      name: '3...Nh5?? hangs',
      elo: 500,
      moves: 'd4 d5 Bf4 Nf6 e3 Nh5',
      punish: 'Qxh5',
      mistake: 'The knight attacks your bishop, but after e3 your queen sees all the way to h5.',
      why: '4.Qxh5 wins a knight. ...Nh5 only works once Nf3 blocks that diagonal or Black has played ...g6.',
    },
    {
      name: '4...Qxb2? pawn grab',
      elo: 1000,
      moves: 'd4 d5 Bf4 c5 e3 Qb6 Nc3 Qxb2',
      punish: 'Nxd5 Bf5 Rb1 Qxa2 Nc7+ Kd8 Nxa8',
      mistake: 'The queen grabs b2 but leaves d5 unguarded. Your knight can jump in with threats.',
      why: '5.Nxd5 threatens Nc7+ forking king and rook, and Rb1 chases the queen. After 5...Bf5 6.Rb1 Qxa2 7.Nc7+ Kd8 8.Nxa8 you have won a rook.',
    },
    {
      name: '2...e5? free pawn',
      elo: 500,
      moves: 'd4 d5 Bf4 e5',
      punish: 'dxe5 Nc6 Nf3',
      mistake: 'Black tries a gambit, but e5 is attacked by your d-pawn and bishop and defended by nothing.',
      why: '3.dxe5 is simply a pawn up. After 3...Nc6 4.Nf3 the e5 pawn is defended twice and Black has nothing for it.',
    },
    {
      name: '6...c4? forgets b7',
      elo: 1250,
      moves: 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nf3 Bg4 Qb3 c4',
      punish: 'Qxb7 Na5 Qc7',
      mistake: 'Black kicks your queen but forgets the b7 pawn it was eyeing.',
      why: '7.Qxb7 grabs the pawn and hits the c6 knight. After 7...Na5 8.Qc7 your queen gets out (offering a trade) and you stay a clean pawn up.',
    },
  ],

  english: [
    {
      name: '4...Ne4? loose knight',
      elo: 750,
      moves: 'c4 Nf6 Nc3 e6 e4 Bb4 e5 Ne4',
      punish: 'Nxe4',
      mistake: 'The knight hops to e4 counting on the pin on c3. It isn\'t a real pin: your d2 pawn still shields the king.',
      why: '5.Nxe4 wins a piece. Before relying on a pin, check that it really is a pin to the king.',
    },
    {
      name: '4...d5? long diagonal',
      elo: 1250,
      moves: 'c4 c5 Nc3 Nc6 g3 Nf6 Bg2 d5',
      punish: 'cxd5 Nxd5 Nxd5 Qxd5 Bxd5',
      mistake: 'Breaking with ...d5 here runs into your g2 bishop, which looks straight down the long diagonal at d5.',
      why: 'After 5.cxd5 Black can\'t take back safely: 5...Nxd5 6.Nxd5 Qxd5?? 7.Bxd5 wins the queen. Black\'s best, 5...Nb4, regains the pawn but leaves you well ahead in development.',
    },
  ],

  vienna: [
    {
      name: '4...Nf6?? Qxf7#',
      elo: 0,
      moves: 'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nf6',
      punish: 'Qxf7#',
      mistake: 'The knight retreats to f6 to attack your queen, but it no longer guards f7.',
      why: '5.Qxf7# is mate: the c4 bishop backs up the queen. The safe retreat is 4...Nd6.',
    },
    {
      name: '6...Nxb5?? mate',
      elo: 750,
      moves: 'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Nc6 Nb5 Nxb5',
      punish: 'Qxf7#',
      mistake: 'Taking your knight pulls the d6 knight away, and it was the only piece guarding f7.',
      why: '7.Qxf7# with the b3 bishop backing up the queen. The book move is 6...g6.',
    },
    {
      name: '4...Ng4?? free knight',
      elo: 500,
      moves: 'e4 e5 Nc3 Nf6 Bc4 Bc5 d3 Ng4',
      punish: 'Qxg4',
      mistake: 'The knight eyes f2 together with the c5 bishop, but nothing protects it on g4.',
      why: '5.Qxg4 wins a piece: your queen on d1 reaches g4 through e2 and f3.',
    },
    {
      name: '4...Nf6? g7 hangs',
      elo: 750,
      moves: 'e4 e5 Nc3 Nc6 Bc4 Bc5 Qg4 Nf6',
      punish: 'Qxg7 Rf8 d3',
      mistake: 'The knight attacks your queen, but with the bishop gone from f8 the g7 pawn is unprotected.',
      why: '5.Qxg7 moves the queen with a capture and hits the rook. After 5...Rf8 you are a pawn up and Black can never castle kingside.',
    },
    {
      name: '3...Qf6? early queen',
      elo: 500,
      moves: 'e4 e5 Nc3 Bc5 Nf3 Qf6',
      punish: 'Nd5 Qd8 Nxe5',
      mistake: 'The queen comes out early and your knights can chase it with tempo.',
      why: '4.Nd5 hits the queen and c7. After 4...Qd8 5.Nxe5 you have won a central pawn and Black is undeveloped.',
    },
  ],

  // ---------------- You play Black ----------------
  'sicilian-najdorf': [
    {
      name: '7.Nf5? ...d5!',
      elo: 1500,
      moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nf5',
      punish: 'd5 Ng3 d4 Nd5 Nxd5 exd5 Qxd5',
      mistake: 'The knight jumps to f5 and looks active, but it does little there and lets you break in the centre.',
      why: '7...d5 hits e4, and exd5 would drop the f5 knight to ...Bxf5. After 8.Ng3 d4 9.Nd5 Nxd5 10.exd5 Qxd5 you have won a pawn.',
    },
    {
      name: '9.h3?? Siberian trap',
      elo: 1250,
      moves: 'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 e6 Bc4 Qc7 O-O Nf6 Qe2 Ng4 h3',
      punish: 'Nd4 Nxd4 Qh2#',
      mistake: 'Against the Smith-Morra (here with ...e6 and ...Qc7) White kicks the g4 knight, but your queen and knight are both aiming at h2.',
      why: '9...Nd4 attacks the queen. 10.Nxd4?? Qh2# (the g4 knight supports it). If the queen moves instead, 10...Nxf3+ wrecks White\'s king.',
    },
  ],

  french: [
    {
      name: '6.Be3? b2 hangs',
      elo: 1000,
      moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Be3',
      punish: 'Qxb2 Nbd2 Qxc3',
      mistake: 'The bishop defends d4 but leaves b2 without protection.',
      why: '6...Qxb2 grabs the pawn, and after 7.Nbd2 Qxc3 you are two pawns up. White\'s lead in development isn\'t enough.',
    },
    {
      name: '8.Nc3? d4 falls',
      elo: 1250,
      moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Bd3 cxd4 cxd4 Bd7 Nc3',
      punish: 'Nxd4 Nxd4 Qxd4',
      mistake: 'White develops but forgets d4: your knight and queen attack it and only the f3 knight defends it.',
      why: '8...Nxd4 9.Nxd4 Qxd4 wins a pawn. The usual Bb5+ trick doesn\'t work here because your bishop on d7 blocks it.',
    },
    {
      name: '7.Nxd4? e5 drops',
      elo: 1500,
      moves: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Qg4 c5 Nf3 cxd4 Nxd4',
      punish: 'Nxe5 Qg3 Nbc6',
      mistake: 'Taking back with the knight removes e5\'s only defender, and your d7 knight is attacking it.',
      why: '7...Nxe5 wins a pawn and hits the queen on g4. After 8.Qg3 Nbc6 you are a pawn up with a strong centre.',
    },
    {
      name: '10.Nf3? Poisoned Pawn',
      elo: 1500,
      moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8 Qxh7 cxd4 Nf3',
      punish: 'Qxc3+ Nd2 Qxa1',
      mistake: 'White develops the knight naturally, but forgets that the c3 pawn is now loose on your queen\'s file.',
      why: '10...Qxc3+ forks the king and the a1 rook. After 11.Nd2 Qxa1 you are a whole rook up. (The book move is 10.Ne2, which covers c3.)',
    },
  ],

  'caro-kann': [
    {
      name: '7.Ne5? ...Qa5+ fork',
      elo: 1250,
      moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 Nf3 Nd7 Ne5',
      punish: 'Nxe5 dxe5 Qa5+ c3 Qxe5+',
      mistake: 'The knight jumps to e5 offering a trade, but after the swap the pawn that lands on e5 is loose.',
      why: '7...Nxe5 8.dxe5 Qa5+ forks the king and the e5 pawn. After 9.c3 Qxe5+ you are a clean pawn up.',
    },
    {
      name: '8.Nf3? walks into the pin',
      elo: 1250,
      moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7 Nf3',
      punish: 'Bxf3 gxf3 Nh5',
      mistake: 'The natural Nf3 runs into your g4 bishop, and White can only take back on f3 with the g-pawn.',
      why: '8...Bxf3 9.gxf3 Nh5 wrecks White\'s kingside pawns and hits the f4 bishop. You win the bishop pair and White\'s king has no safe home.',
    },
  ],

  scandinavian: [
    {
      name: '8.Ne5? d4 drops',
      elo: 1000,
      moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 Nf3 Nf6 Be2 Bg4 d4 e6 O-O Nc6 Ne5',
      punish: 'Bxe2 Qxe2 Nxd4',
      mistake: 'The knight leaves f3, so only the queen still defends d4, and you can pull the queen away.',
      why: '8...Bxe2 9.Qxe2 Nxd4 wins a pawn and hits the queen.',
    },
    {
      name: '7.Be2? d4 drops',
      elo: 1000,
      moves: 'e4 d5 e5 c5 c3 Nc6 d4 cxd4 cxd4 Qb6 Nf3 Bg4 Be2',
      punish: 'Bxf3 Bxf3 Qxd4',
      mistake: 'd4 is attacked by your knight and queen. Its defender, the f3 knight, can be removed.',
      why: '7...Bxf3 8.Bxf3 Qxd4 wins the pawn. Removing a defender is the simplest way to win material.',
    },
  ],

  'open-game-black': [
    {
      name: '4.Ng5?? Qxg5',
      elo: 0,
      moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 Ng5',
      punish: 'Qxg5',
      mistake: 'White attacks f7, but the knight on g5 is unprotected and your queen can reach it.',
      why: '4...Qxg5 wins a knight. Always check whether the attacking piece is defended.',
    },
    {
      name: '6.Nc3?? Qxf2#',
      elo: 500,
      moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nxc6 Qf6 Nc3',
      punish: 'Qxf2#',
      mistake: 'White develops and ignores your threat: the queen on f6 and the c5 bishop both aim at f2.',
      why: '6...Qxf2# is mate. In this line White must play 6.Qd2 or 6.Qf3 to cover f2.',
    },
    {
      name: '6.Bd3?? blocks the queen',
      elo: 750,
      moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nc3 Bb4 Bd3',
      punish: 'Nxd4',
      mistake: 'The bishop on d3 cuts off the queen, and the queen was the only defender of the d4 knight.',
      why: '6...Nxd4 wins a knight for free. (The book order is 6.Nxc6 bxc6 7.Bd3.)',
    },
    {
      name: '6.Nxe5? Berlin',
      elo: 1000,
      moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 Bxc6 dxc6 Nxe5',
      punish: 'Qd4 Nf3 Qxf2#',
      mistake: 'White grabs e5, but the knight is now loose and f2 is weak with your bishop on c5.',
      why: '6...Qd4 attacks e5 and threatens mate on f2. 7.Nf3?? Qxf2# ends the game. Even after 7.Qe2 Qxe5 you have the pawn back and the bishop pair.',
    },
    {
      name: '8.Bxf4? King’s Gambit',
      elo: 1000,
      moves: 'e4 e5 f4 exf4 Nf3 d5 exd5 Nf6 Nc3 Nxd5 Nxd5 Qxd5 d4 Be7 Bxf4',
      punish: 'Qe4+ Be2 Qxf4',
      mistake: 'White wins the pawn back, but the bishop on f4 and the king on e1 are both on your queen\'s lines.',
      why: '8...Qe4+ forks the king and the f4 bishop. After 9.Be2 Qxf4 you are a piece up.',
    },
    {
      name: '5.g4? Scholar’s mate try',
      elo: 0,
      moves: 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 g4',
      punish: 'Nd4 Qd1 d5',
      mistake: 'White keeps attacking with the queen and pawns instead of developing. The c2 pawn and the queen are targets.',
      why: '5...Nd4 hits the queen and threatens ...Nxc2+. After 6.Qd1 d5 you open lines while White has nothing developed.',
    },
    {
      name: '5.Qb3? Scholar’s mate try',
      elo: 500,
      moves: 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Qb3',
      punish: 'Nd4 Bxf7+ Ke7 Qc4 b5',
      mistake: 'The queen goes to b3 to keep hitting f7, but it is far from safe there.',
      why: '5...Nd4 hits the queen. 6.Bxf7+ Ke7 7.Qc4 b5 chases the queen and traps the f7 bishop: you win a piece for a pawn.',
    },
  ],

  'kings-indian': [
    {
      name: '8.cxd6? Four Pawns',
      elo: 1500,
      moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4 O-O Nf3 c5 dxc5 Qa5 cxd6',
      punish: 'Nxe4',
      mistake: 'White grabs another pawn, but the c3 knight is pinned by your queen and can\'t defend e4.',
      why: '8...Nxe4 wins the e4 pawn, opens your g7 bishop\'s diagonal at c3 and leaves White\'s king stuck in the centre.',
    },
    {
      name: '8.e5? too early',
      elo: 1500,
      moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4 O-O Nf3 c5 d5 e6 e5',
      punish: 'dxe5 fxe5 Ng4',
      mistake: 'White pushes before finishing development, and the e5 pawn can\'t be held.',
      why: '8...dxe5 9.fxe5 Ng4 attacks e5 with the knight and the g7 bishop. You win the pawn and White\'s centre falls apart.',
    },
  ],

  nimzo: [
    {
      name: '7.Nd2? Kasparov line',
      elo: 1750,
      moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5 g3 Ne4 Qd3 Qa5 Nd2',
      punish: 'Nxc3 bxc3 Bxc3',
      mistake: 'The knight breaks the pin on the e4 knight, but c3 is now attacked three times.',
      why: '7...Nxc3 8.bxc3 Bxc3 hits the a1 rook and pins the d2 knight. You win material.',
    },
    {
      name: '8.dxe5? 4.f3 line',
      elo: 1750,
      moves: 'd4 Nf6 c4 e6 Nc3 Bb4 f3 d5 a3 Be7 e4 dxe4 fxe4 e5 dxe5',
      punish: 'Qxd1+ Kxd1 Ng4',
      mistake: 'Taking on e5 trades queens and leaves the pawn on e5 weak with White\'s king stuck on d1.',
      why: '8...Qxd1+ 9.Kxd1 Ng4 attacks e5. You win the pawn back and White has lost the right to castle.',
    },
  ],
};
