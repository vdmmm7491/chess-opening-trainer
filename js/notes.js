// Coach notes: the IDEA behind key moves, written by hand.
// Key = the full move sequence from the start position up to and including the move (SAN, space-separated).
// The same key works in every opening that reaches that position.
// tools/validate.html checks that every key is a legal move sequence.

export const NOTES = {
  // ---------- First moves ----------
  'e4': 'Takes the centre and opens lines for the queen and the f1 bishop.',
  'd4': 'Takes the centre. The pawn is already protected by the queen, which makes d4 solid.',
  'c4': 'Controls d5 from the side. A flexible start that can turn into many different structures.',
  'e4 e5': 'Meets White in the centre symmetrically. It is the most classical answer.',
  'e4 e5 Nf3': 'Develops with an attack on the e5 pawn.',
  'e4 e5 Nf3 Nc6': 'Develops the knight while defending e5.',
  'd4 Nf6': 'Develops and stops e4. Black stays flexible about which setup to choose.',

  // ---------- Italian ----------
  'e4 e5 Nf3 Nc6 Bc4': 'The Italian bishop eyes f7, the weakest square in Black\'s camp because only the king defends it.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5': 'Black mirrors White: the bishop aims at f2, White\'s weak spot.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3': 'Prepares d4 for a big centre, and gives the bishop a retreat square on c2.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3': 'The slow "Pianissimo": protect e4 calmly, castle, then improve your pieces (Nbd2–f1–g3) before acting.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1': 'The rook backs up e4 and supports a later d4 break.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3': 'Retreat the bishop before ...b5 or ...Na5 can chase it with tempo.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4': 'The sharp approach: blow open the centre right away while Black\'s king is still in the middle.',
  'e4 e5 Nf3 Nc6 Bc4 Nf6': 'The Two Knights: Black counter-attacks e4 instead of copying with ...Bc5.',
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5': 'Attacks f7 twice (knight and bishop). Black must react immediately with ...d5.',
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5': 'Black gives up a pawn to chase away your strong c4 bishop. Play Bb5+, not the risky Nxf7.',
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+': 'Check first, so that ...c6 costs Black time while you keep the extra pawn.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 b4': 'The Evans Gambit: give up the b-pawn to win time for c3 and d4, with a fast attack.',
  'e4 e5 Nf3 Nc6 Bc4 Nd4': 'A trap! e5 looks free, but after Nxe5? comes ...Qg5!, hitting g2 and e5, and Black wins.',
  'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4': 'Just trade off the annoying knight. After ...exd4 c3, you get a big centre.',

  // ---------- Ruy López ----------
  'e4 e5 Nf3 Nc6 Bb5': 'Attacks the knight that defends e5. It is not a threat yet, but the pressure lasts the whole game.',
  'e4 e5 Nf3 Nc6 Bb5 a6': 'Asks the bishop what it wants: retreat to a4 or trade on c6.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4': 'Keeps the pressure on c6 instead of trading the bishop.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O': 'Castle first. If ...Nxe4, the e-pawn can be won back later with Re1.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1': 'Defends e4. Now Bxc6 followed by Nxe5 becomes a real threat.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3': 'The bishop finds the a2–g8 diagonal and keeps eyeing f7.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3': 'Prepares d4, and gives the bishop a retreat square on c2.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3': 'Stops ...Bg4 pinning the f3 knight before you play d4.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5': 'The Marshall Gambit: Black gives up a pawn for a dangerous kingside attack.',
  'e4 e5 Nf3 Nc6 Bb5 Nf6': 'The Berlin: Black counter-attacks e4 instead of defending passively.',
  'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4': 'Hit back in the centre. The e-pawn is won back with interest.',
  'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8': 'The famous Berlin endgame: Black has lost the right to castle but has the bishop pair.',
  'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6': 'Exchange Variation: give up the bishop to double Black\'s pawns. The endgame favours you.',
  'e4 e5 Nf3 Nc6 Bb5 f5': 'The Schliemann: a gambit-style counter-attack against e4.',

  // ---------- Scotch ----------
  'e4 e5 Nf3 Nc6 d4': 'Opens the centre at once, with no slow manoeuvring.',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4': 'Recapture with the knight. It\'s centralised, and White has a free hand in the centre.',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5': 'Kicks the f6 knight away, gaining space and time.',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2': 'Meets the pin on the e-file. The queen guards e5 and blocks the attack.',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4': 'Black hits e4 and f2 at the same time. Nc3 defends calmly and develops.',

  // ---------- Queen's Gambit ----------
  'd4 d5 c4': 'Offers the c-pawn to lure Black\'s d-pawn away from the centre. If ...dxc4, e3 and Bxc4 win it back.',
  'd4 d5 c4 e6': 'The QGD: Black holds d5 with a pawn, but the c8 bishop is shut in for now.',
  'd4 d5 c4 e6 Nc3 Nf6 Bg5': 'Pins the f6 knight, which defends d5, putting even more pressure on the centre.',
  'd4 d5 c4 dxc4': 'Black takes the pawn but gives up the centre. Don\'t chase the pawn: just develop and win it back.',
  'd4 d5 c4 dxc4 Nf3 Nf6 e3': 'Opens the f1 bishop\'s path to c4 to win back the pawn.',
  'd4 d5 c4 c6': 'The Slav: Black defends d5 with a pawn while keeping the c8 bishop free.',
  'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4': 'Stops ...b5, so Black cannot hold on to the c4 pawn.',
  'd4 d5 c4 e5': 'The Albin Countergambit. After dxe5 d4, Black\'s pawn cramps you, but Nf3 and g3 neutralise it.',
  'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5': 'Exchange structure: your plan is the minority attack, pushing b4–b5 on the queenside.',
  'd4 d5 c4 e6 Nc3 c5': 'The Tarrasch: Black accepts an isolated d-pawn in return for very active pieces.',

  // ---------- London ----------
  'd4 d5 Bf4': 'The London bishop comes out BEFORE e3, so that it isn\'t locked in behind the pawns.',
  'd4 d5 Bf4 Nf6 e3': 'Solid: supports d4 and opens the way for the f1 bishop.',
  'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3': 'The d4/e3/c3 pyramid is rock solid. If ...cxd4, recapture and stay in control.',
  'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2': 'Develops the knight to support e4, and leaves c3 for the pawn.',
  'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3': 'Avoid trading on d6. Keep your good bishop and stay solid.',
  'd4 Nf6 Bf4 c5 e3 Qb6': 'Black attacks b2. Nc3! is the clever answer.',
  'd4 Nf6 Bf4 c5 e3 Qb6 Nc3 Qxb2 Nb5': 'Threatens Nc7+, forking king and rook. Black\'s queen grab is dangerous.',
  'd4 Nf6 Bf4 g6 Nc3 d5 e3 Bg7 h4': 'The Jobava idea: an early h4–h5 to pry open Black\'s kingside.',

  // ---------- English ----------
  'c4 e5 Nc3': 'A reversed Sicilian: you are a whole tempo up on Black\'s usual Sicilian setups.',
  'c4 e5 Nc3 Nf6 g3': 'Fianchetto: the g2 bishop will rake the long diagonal toward d5 and b7.',
  'c4 Nf6 Nc3 e6 e4': 'The Mikenas: grab the centre with tempo. After ...d5, e5 kicks the knight.',

  // ---------- Vienna ----------
  'e4 e5 Nc3': 'Develops and controls d5 while keeping the f-pawn free to advance to f4.',
  'e4 e5 Nc3 Nf6 f4': 'The Vienna Gambit: open the f-file and attack before Black is organised.',
  'e4 e5 Nc3 Nf6 f4 d5': 'Black strikes back in the centre. This is the best reply to the gambit.',
  'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3': 'Develops and defends e5. You have more space.',
  'e4 e5 Nc3 Nf6 f4 exf4 e5': 'Kick the knight before Black can play ...d5. The f4 pawn falls later.',
  'e4 e5 Nc3 Bc5 Nf3 d6 Na4': 'Chase the bishop and trade it off. It is Black\'s best attacker against f2.',

  // ---------- Sicilian Najdorf ----------
  'e4 c5': 'The Sicilian: fight for d4 from the side and steer for an unbalanced game.',
  'e4 c5 Nf3 d6 d4 cxd4': 'Swap a side pawn for a centre pawn. Black gets the half-open c-file and two central pawns.',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6': 'Attacks e4, so White has to spend a move on Nc3.',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6': 'The Najdorf move: it keeps White\'s pieces off b5 and prepares ...e5 or ...b5.',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5': 'Kicks the d4 knight. Black accepts a hole on d5 in return for active play.',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6': 'Breaks the coming pin pressure on f6 and keeps d5 covered.',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bc4 e6': 'Blunts the c4 bishop by shutting the a2–g8 diagonal.',
  'e4 c5 d4 cxd4 c3': 'The Smith-Morra Gambit. Accept with ...dxc3 and develop calmly. The extra pawn is yours.',
  'e4 c5 c3 Nf6': 'Hit e4 at once. Against the Alapin, the knight jumps to d5 after e5.',

  // ---------- French ----------
  'e4 e6': 'Prepares ...d5 with pawn support. Solid, but the c8 bishop stays shut in for a while.',
  'e4 e6 d4 d5 e5 c5': 'Hits the base of White\'s pawn chain. This is THE key French idea.',
  'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6': 'Piles up on d4: three Black pieces now attack it.',
  'e4 e6 d4 d5 Nc3 Bb4': 'The Winawer: pin the knight to increase pressure on e4.',
  'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+': 'Black gives up the bishop pair but doubles White\'s c-pawns.',
  'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7': 'The knight retreats, but it will attack the pawn chain with ...c5 and ...f6.',
  'e4 e6 d4 d5 exd5 exd5': 'Symmetrical: Black\'s c8 bishop is suddenly free, so the French problem is solved.',

  // ---------- Caro-Kann ----------
  'e4 c6': 'Prepares ...d5 while keeping the c8 bishop free (unlike the French).',
  'e4 c6 d4 d5 e5 Bf5': 'Gets the light-squared bishop OUT before ...e6 locks it in.',
  'e4 c6 d4 d5 e5 Bf5 Nf3 e6': 'Now ...e6 is fine, because the bishop is already outside the pawn chain.',
  'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5': 'Attacks the base of the chain, the same idea as in the French.',
  'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5': 'Develops with tempo on the e4 knight.',
  'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6': 'Makes room so that the bishop can drop back to h7 when h5 comes.',
  'e4 c6 d4 d5 exd5 cxd5 c4': 'The Panov: you will get an isolated-pawn position. Aim your pieces at d4 and the kingside.',

  // ---------- Scandinavian ----------
  'e4 d5': 'Challenges e4 immediately, so the game starts on your terms.',
  'e4 d5 exd5 Qxd5 Nc3 Qa5': 'The queen is safe on a5, and it pins the c3 knight once d4 is played.',
  'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6': 'Gives the queen a retreat square on c7 and takes b5 and d5 under control.',
  'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5': 'Develop the bishop outside the pawn chain before ...e6.',
  'e4 d5 exd5 Qxd5 Nc3 Qd6': 'The modern ...Qd6: the queen is harder to attack and controls the b8–h2 diagonal.',

  // ---------- 1...e5 as Black ----------
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6': 'Hits e4 right away, before White can set up d4.',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+': 'Check first to trade off the bishop, then strike with ...d5.',
  'e4 e5 Nf3 Nc6 c3 Nf6': 'Hit e4 at once. The c3 pawn has taken that square away from White\'s knight.',
  'e4 e5 f4 exf4': 'Take the gambit pawn. ...d5 next frees your whole game.',
  'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Nd4': 'The Rubinstein: an active counter-punch instead of a dull, symmetrical game.',

  // ---------- King's Indian ----------
  'd4 Nf6 c4 g6': 'A fianchetto setup: let White build a big centre, then attack it.',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5': 'The key break: challenge d4 with a pawn.',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7': 'The centre is closed. The knight heads for the kingside to support ...f5.',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7': 'Prepares ...f5, the start of the famous kingside pawn storm.',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5': 'The knight eyes f4 and makes way for ...f5.',

  // ---------- Nimzo-Indian ----------
  'd4 Nf6 c4 e6 Nc3 Bb4': 'Pin the knight to stop e4. You fight for the centre with pieces instead of pawns.',
  'd4 Nf6 c4 e6 Nc3 Bb4 Qc2': 'White avoids doubled pawns by planning to recapture on c3 with the queen.',
  'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+': 'Give up the bishop pair, but White\'s queen is pulled to c3.',
  'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6': 'Prepares ...Bb7 to fight for e4 along the long diagonal.',
  'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O': 'Castle first, then choose between ...d5, ...c5 or ...b6 depending on White\'s setup.',
  'd4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3': 'White has doubled c-pawns. Target the weak c4 pawn with ...b6, ...Ba6 and ...Nc6–a5.',
};
