// Famous games featuring the trainer's openings.
// Every score was copied from a published source (listed in `source`), not written from memory.
// Move-by-move commentary lives in game-notes.js (keyed by game id and ply).
// `analysis: true` marks illustrative lines that are NOT recorded games.

import { GAME_NOTES } from './game-notes.js';

export const GAMES = [
  {
    id: 'gelfand-nakamura-2010',
    title: 'Nakamura\'s King\'s Indian masterpiece',
    white: 'Boris Gelfand', black: 'Hikaru Nakamura', event: 'World Team Championship, Bursa', year: 2010, result: '0-1',
    opening: 'King\'s Indian Defence, Mar del Plata (E97)', openingId: 'kings-indian',
    famous: 'Hikaru calls this his best King\'s Indian win. White races on the queenside while Black storms the king, and Nakamura breaks through with a knight sacrifice on g2.',
    moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Nd2 Ne8 b4 f5 c5 Nf6 f3 f4 Nc4 g5 a4 Ng6 Ba3 Rf7 b5 dxc5 Bxc5 h5 a5 g4 b6 g3 Kh1 Bf8 d6 axb6 Bg1 Nh4 Re1 Nxg2 dxc7 Nxe1 Qxe1 g2+ Kxg2 Rg7+ Kh1 Bh3 Bf1 Qd3 Nxe5 Bxf1 Qxf1 Qxc3 Rc1 Qxe5 c8=Q Rxc8 Rxc8 Qe6',
    source: 'https://en.chessbase.com/post/bursa-wtc-nakamura-beats-gelfand-in-round-five',
  },
  {
    id: 'fischer-spassky-1972-g6',
    title: 'Fischer plays the Queen\'s Gambit "to perfection"',
    white: 'Bobby Fischer', black: 'Boris Spassky', event: 'World Championship, Reykjavík, game 6', year: 1972, result: '1-0',
    opening: 'Queen\'s Gambit Declined, Tartakower (D59)', openingId: 'queens-gambit',
    famous: 'Fischer, a lifelong 1.e4 player, surprised Spassky with a Queen\'s Gambit and won a model positional game. It gave him the lead in the match for the first time.',
    moves: 'c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Ra7 Be2 Nd7 Nd4 Qf8 Nxe6 fxe6 e4 d4 f4 Qe7 e5 Rb8 Bc4 Kh8 Qh3 Nf8 b3 a5 f5 exf5 Rxf5 Nh7 Rcf1 Qd8 Qg3 Re7 h4 Rbb7 e6 Rbc7 Qe5 Qe8 a4 Qd8 R1f2 Qe8 R2f3 Qd8 Bd3 Qe8 Qe4 Nf6 Rxf6 gxf6 Rxf6 Kg8 Bc4 Kh8 Qf4',
    source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1972',
  },
  {
    id: 'spassky-fischer-1972-g5',
    title: 'Fischer\'s Nimzo-Indian squeeze',
    white: 'Boris Spassky', black: 'Bobby Fischer', event: 'World Championship, Reykjavík, game 5', year: 1972, result: '0-1',
    opening: 'Nimzo-Indian Defence, Hübner Variation (E41)', openingId: 'nimzo',
    famous: 'Fischer gives up his bishop for a knight to double White\'s pawns, locks the centre, and outplays Spassky. 27...Bxa4 levelled the match.',
    moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5 e3 Nc6 Bd3 Bxc3+ bxc3 d6 e4 e5 d5 Ne7 Nh4 h6 f4 Ng6 Nxg6 fxg6 fxe5 dxe5 Be3 b6 O-O O-O a4 a5 Rb1 Bd7 Rb2 Rb8 Rbf2 Qe7 Bc2 g5 Bd2 Qe8 Be1 Qg6 Qd3 Nh5 Rxf8+ Rxf8 Rxf8+ Kxf8 Bd1 Nf4 Qc2 Bxa4',
    source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1972',
  },
  {
    id: 'deepblue-kasparov-1997',
    title: 'Deep Blue beats Kasparov',
    white: 'Deep Blue', black: 'Garry Kasparov', event: 'IBM rematch, New York, game 6', year: 1997, result: '1-0',
    opening: 'Caro-Kann Defence, Steinitz Variation (B17)', openingId: 'caro-kann',
    famous: 'The game that decided the first match a world champion lost to a computer. Kasparov chose a dubious line, and Deep Blue\'s knight sacrifice on e6 broke through in 19 moves.',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Ng5 Ngf6 Bd3 e6 N1f3 h6 Nxe6 Qe7 O-O fxe6 Bg6+ Kd8 Bf4 b5 a4 Bb7 Re1 Nd5 Bg3 Kc8 axb5 cxb5 Qd3 Bc6 Bf5 exf5 Rxe7 Bxe7 c4',
    source: 'https://en.wikipedia.org/wiki/Deep_Blue_versus_Garry_Kasparov',
  },
  {
    id: 'fischer-spassky-1992-g1',
    title: 'Fischer\'s comeback Ruy López',
    white: 'Bobby Fischer', black: 'Boris Spassky', event: 'Fischer–Spassky rematch, Sveti Stefan, game 1', year: 1992, result: '1-0',
    opening: 'Ruy López, Breyer Variation (C95)', openingId: 'ruy-lopez',
    famous: 'Fischer\'s first game in 20 years. It is a textbook Closed Ruy López, with the knight manoeuvre to g3 and a queenside squeeze.',
    moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d6 h3 Nb8 d4 Nbd7 Nbd2 Bb7 Bc2 Re8 Nf1 Bf8 Ng3 g6 Bg5 h6 Bd2 Bg7 a4 c5 d5 c4 b4 Nh7 Be3 h5 Qd2 Rf8 Ra3 Ndf6 Rea1 Qd7 R1a2 Rfc8 Qc1 Bf8 Qa1 Qe8 Nf1 Be7 N1d2 Kg7 Nb1 Nxe4 Bxe4 f5 Bc2 Bxd5 axb5 axb5 Ra7 Kf6 Nbd2 Rxa7 Rxa7 Ra8 g4 hxg4 hxg4 Rxa7 Qxa7 f4 Bxf4 exf4 Nh4 Bf7 Qd4+ Ke6 Nf5 Bf8 Qxf4 Kd7 Nd4 Qe1+ Kg2 Bd5+ Be4 Bxe4+ Nxe4 Be7 Nxb5 Nf8 Nbxd6 Ne6 Qe5',
    source: 'https://en.wikipedia.org/wiki/Fischer%E2%80%93Spassky_(1992_match)',
  },
  {
    id: 'evergreen-1852',
    title: 'The Evergreen Game',
    white: 'Adolf Anderssen', black: 'Jean Dufresne', event: 'Berlin (casual game)', year: 1852, result: '1-0',
    opening: 'Evans Gambit (C52)', openingId: 'italian',
    famous: 'One of the most famous attacking games ever. Steinitz called it the "evergreen in Anderssen\'s laurel crown". It ends in a brilliant double-check mating combination.',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#',
    source: 'https://en.wikipedia.org/wiki/Evergreen_Game',
  },
  {
    id: 'opera-game-1858',
    title: 'The Opera Game',
    white: 'Paul Morphy', black: 'Duke Karl of Brunswick & Count Isouard', event: 'Paris Opera (consultation game)', year: 1858, result: '1-0',
    opening: 'Philidor Defence (C41), an Open Game', openingId: 'open-game-black',
    famous: 'Played during an opera performance. It\'s the perfect lesson in development: Morphy develops every piece with tempo while his opponents grab material, then finishes with a queen sacrifice.',
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
    source: 'https://en.wikipedia.org/wiki/Opera_Game',
  },
  {
    id: 'karpov-kasparov-1985-g16',
    title: 'Kasparov\'s octopus knight',
    white: 'Anatoly Karpov', black: 'Garry Kasparov', event: 'World Championship, Moscow, game 16', year: 1985, result: '0-1',
    opening: 'Sicilian Defence, Kan/Taimanov (B44)', openingId: 'sicilian-najdorf',
    famous: 'A knight on d3 paralyses White\'s whole position. Chess Informant readers voted it the best game of its first 64 volumes. Kasparov went on to win the title.',
    moves: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nb5 d6 c4 Nf6 N1c3 a6 Na3 d5 cxd5 exd5 exd5 Nb4 Be2 Bc5 O-O O-O Bf3 Bf5 Bg5 Re8 Qd2 b5 Rad1 Nd3 Nab1 h6 Bh4 b4 Na4 Bd6 Bg3 Rc8 b3 g5 Bxd6 Qxd6 g3 Nd7 Bg2 Qf6 a3 a5 axb4 axb4 Qa2 Bg6 d6 g4 Qd2 Kg7 f3 Qxd6 fxg4 Qd4+ Kh1 Nf6 Rf4 Ne4 Qxd3 Nf2+ Rxf2 Bxd3 Rfd2 Qe3 Rxd3 Rc1 Nb2 Qf2 Nd2 Rxd1+ Nxd1 Re1+',
    source: 'https://en.wikipedia.org/wiki/World_Chess_Championship_1985',
  },
  {
    id: 'game-of-the-century-1956',
    title: 'The Game of the Century',
    white: 'Donald Byrne', black: 'Bobby Fischer (age 13)', event: 'Rosenwald Memorial, New York', year: 1956, result: '0-1',
    opening: 'Grünfeld Defence (D92)', openingId: null,
    famous: '13-year-old Fischer sacrifices his queen with 17...Be6!!, collects a huge amount of material with a "windmill" of discovered checks, and mates. This opening isn\'t in the trainer yet.',
    moves: 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#',
    source: 'https://en.wikipedia.org/wiki/The_Game_of_the_Century_(chess)',
  },
  {
    id: 'kasparov-topalov-1999',
    title: 'Kasparov\'s Immortal',
    white: 'Garry Kasparov', black: 'Veselin Topalov', event: 'Wijk aan Zee', year: 1999, result: '1-0',
    opening: 'Pirc Defence (B07)', openingId: null,
    famous: 'Often called the greatest game ever played. Kasparov sacrifices a rook with 24.Rxd4!! and chases Black\'s king all the way across the board. This opening isn\'t in the trainer yet.',
    moves: 'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7 a3 e5 O-O-O Qe7 Kb1 a6 Nc1 O-O-O Nb3 exd4 Rxd4 c5 Rd1 Nb6 g3 Kb8 Na5 Ba8 Bh3 d5 Qf4+ Ka7 Rhe1 d4 Nd5 Nbxd5 exd5 Qd6 Rxd4 cxd4 Re7+ Kb6 Qxd4+ Kxa5 b4+ Ka4 Qc3 Qxd5 Ra7 Bb7 Rxb7 Qc4 Qxf6 Kxa3 Qxa6+ Kxb4 c3+ Kxc3 Qa1+ Kd2 Qb2+ Kd1 Bf1 Rd2 Rd7 Rxd7 Bxc4 bxc4 Qxh8 Rd3 Qa8 c3 Qa4+ Ke1 f4 f5 Kc1 Rd2 Qa7',
    source: 'https://en.wikipedia.org/wiki/Kasparov%27s_Immortal',
  },
  {
    id: 'alien-gambit-trap',
    title: 'Alien Gambit: the "king walks forward" trap',
    white: 'Analysis', black: 'Analysis', event: 'Illustrative trap line (not a recorded game)', year: 2023, result: '1-0',
    opening: 'Caro-Kann, Alien Gambit (B15)', openingId: 'alien-gambit', analysis: true,
    famous: 'The Alien Gambit sacrifices a knight on f7 to drag the black king out. This is its best-known trap. It is an illustrative line, not a recorded game.',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7 Kxf7 Nf3 c5 Bc4+ Kg6 Ne5+ Kh7 Qd3+ g6 Qxg6#',
    source: 'https://ramachess.com/articles/alien-gambit/',
  },
];

for (const g of GAMES) g.notes = GAME_NOTES[g.id] || {};

export function getGame(id) { return GAMES.find((g) => g.id === id); }
