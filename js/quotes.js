// Data for the corner widget (js/corner.js).

// Well-known quotes from chess masters. Attributions are the commonly cited ones.
export const QUOTES = [
  { text: 'Tactics is knowing what to do when there is something to do; strategy is knowing what to do when there is nothing to do.', by: 'Savielly Tartakower' },
  { text: 'When you see a good move, look for a better one.', by: 'Emanuel Lasker' },
  { text: 'In order to improve your game, you must study the endgame before everything else.', by: 'José Raúl Capablanca' },
  { text: 'You must take your opponent into a deep dark forest where 2+2=5, and the path leading out is only wide enough for one.', by: 'Mikhail Tal' },
  { text: 'Play the opening like a book, the middlegame like a magician, and the endgame like a machine.', by: 'Rudolf Spielmann' },
  { text: 'The pawns are the soul of chess.', by: 'François-André Philidor' },
  { text: 'Chess is everything: art, science and sport.', by: 'Anatoly Karpov' },
  { text: 'The threat is stronger than the execution.', by: 'Aron Nimzowitsch' },
  { text: 'The blunders are all there on the board, waiting to be made.', by: 'Savielly Tartakower' },
  { text: 'Without error there can be no brilliancy.', by: 'Emanuel Lasker' },
  { text: 'Even a poor plan is better than no plan at all.', by: 'Mikhail Chigorin' },
  { text: 'Chess is 99 percent tactics.', by: 'Richard Teichmann' },
  { text: 'Strategy requires thought, tactics require observation.', by: 'Max Euwe' },
  { text: 'Chess is the struggle against error.', by: 'Johannes Zukertort' },
  { text: 'It is not enough to be a good player; you must also play well.', by: 'Siegbert Tarrasch' },
  { text: 'Chess, like love, like music, has the power to make men happy.', by: 'Siegbert Tarrasch' },
  { text: 'I don’t believe in psychology. I believe in good moves.', by: 'Bobby Fischer' },
  { text: 'Chess is a matter of delicate judgement, knowing when to punch and how to duck.', by: 'Bobby Fischer' },
  { text: 'Win with grace, lose with dignity!', by: 'Susan Polgar' },
  { text: 'Chess is mental torture.', by: 'Garry Kasparov' },
];

// Highly rated books for going deeper. Ratings are Goodreads averages (rounded),
// checked November 2026 – they drift a little over time.
export const RATINGS_SOURCE = 'Goodreads';
export const RATINGS_CHECKED = 'Nov 2026';

const gr = (q) => `https://www.goodreads.com/search?q=${encodeURIComponent(q)}`;

export const BOOKS = [
  { title: 'Fundamental Chess Openings', author: 'Paul van der Sterren', rating: 4.2, why: 'The ideas behind every major opening, explained in plain words.', url: gr('Fundamental Chess Openings van der Sterren') },
  { title: 'Logical Chess: Move by Move', author: 'Irving Chernev', rating: 4.3, why: 'Every single move of 33 master games explained.', url: gr('Logical Chess Move by Move Chernev') },
  { title: 'Understanding Chess Move by Move', author: 'John Nunn', rating: 4.2, why: 'Modern games, annotated to show how strong players think.', url: gr('Understanding Chess Move by Move Nunn') },
  { title: 'My System', author: 'Aron Nimzowitsch', rating: 4.2, why: 'The classic on positional play: centre, open files, outposts.', url: gr('My System Nimzowitsch') },
  { title: 'Capablanca’s Best Chess Endings', author: 'Irving Chernev', rating: 4.4, why: 'Where the opening leads: clean, instructive endgames.', url: gr('Capablanca\'s Best Chess Endings Chernev') },
];
