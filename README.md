# ♟ Opening Trainer

A **free**, open-source website for practising chess openings. Works on phones and desktops, no account and no install needed.

## Features

- **Opening trainer**: 14 openings (7 for White, 7 for Black), 109 book lines, including short lines against the opponent's common alternatives. You play your side and get instant feedback.
  - **Learn** mode shows the next move with an arrow.
  - **Practice** mode tests you from memory. Two wrong tries reveal the answer.
  - **Spaced repetition** brings lines you get wrong back sooner (levels 0–5).
  - **Play on vs Stockfish** lets you keep playing the position after the book ends.
- **Famous games** tab: 10 classic games replayable move by move, with commentary on every move, a Stockfish badge on every move (rated in your browser the first time you open a game, then saved) and a game report counting each player's top moves, mistakes and blunders. Examples are Gelfand–Nakamura 2010 (King's Indian), Fischer–Spassky 1972 (Queen's Gambit, Nimzo-Indian), Deep Blue–Kasparov 1997 (Caro-Kann) and the Evergreen and Opera games. Every score is copied from a published source, linked on each game. There's also an Alien Gambit trap line, clearly marked as analysis.
- **Alien Gambit** (Witty Alien's knight sacrifice against the Caro-Kann) as a White opening, with its main line, traps and Black's best defences.
- **🧩 Quiz** for every opening, unlocked once you've completed 2 of its lines in Practice mode: 10 random positions from all its lines (move 3 onwards, always your move). Find the book move in one try. The coach explains the answer, and your best score is saved.
- **Opening coach** (🎓 panel in the trainer, can be switched off):
  - every move of every book line (972 positions) has a hand-written explanation of the idea behind it, based on standard opening theory. It covers your moves and your opponent's, plus the plan for each opening and a "Read more" link to a reference article
  - when you play a wrong move, Stockfish works out what it costs, then the coach **plays out how the opponent punishes it** on the board (replayable, and each move is clickable), explains why the book move is better, and lets you try again
  - harmless alternatives are labelled "Playable" instead of being treated as blunders
  - the coach is for the opening only. It switches off in free play after the book ends
- **Stockfish evaluation bar**: Stockfish 10 runs in your browser in a Web Worker. The best engine line is hidden while you practise so it doesn't give away the answer.
- **Analysis board**: best-move arrow, engine line, book detection, play vs Stockfish, load a FEN or move list.
- **Openings by rating**: every opening is tagged with the levels it suits (Beginner under 1000, Intermediate 1000–1600, Advanced 1600–2000, Expert 2000+) and a note explaining why. Pick a level or type in your rating to filter.
- **Board you can draw on**: right-click and drag to draw arrows (knight moves get L-shaped arrows), right-click a square to highlight it. Hold Shift, Ctrl or Alt for green, red or blue. Left-click clears them.
- **Appearance settings** (⚙ in the top bar): 5 piece sets, 7 board colours, dark or light theme.
- **Progress tracking**: streak, activity heatmap, mastery per opening and line, recent sessions. Export/import moves your progress between devices.
- **Game review** (Review tab): enter a Chess.com username to download public games through Chess.com's public API (no login needed). You get:
  - win/draw/loss by opening, as White and as Black
  - **the moves where you left your repertoire**, with a "Drill" button for that line
  - a **Stockfish opening check** that rates each of your moves in the first 12 moves of recent games, with our own labels: Masterstroke `!!`, Only move `!`, Top move, Solid, Theory, Dubious `?!`, Mistake `?` and Blunder `??`. Each game opens on the analysis board with the badges shown on the moves

## Run it locally

It's a static site with **no build step**, so any static file server works:

```bash
# Windows (no Node/Python needed)
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
# or, anywhere with Python
python -m http.server 8080
# or Node
npx serve .
```

Then open http://localhost:8080. Opening `index.html` directly as a `file://` URL **won't work** because browsers block ES modules and Web Workers from `file://`.

## Deploy for free (GitHub Pages)

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` and `/ (root)`, then Save.
3. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

You can do all of this from the GitHub mobile website.

## Project structure

```
index.html              App shell (nav + <main id="app">)
manifest.webmanifest    "Add to home screen" support
css/style.css           All styles (dark theme, responsive)
js/app.js               Hash router (#/, #/train/:id, #/analysis, #/progress, #/chesscom)
js/openings.js          ← Opening repertoire data. Add openings/lines here.
js/board.js             Dependency-free chessboard (tap or drag, promotion picker, arrows)
js/engine.js            Stockfish UCI wrapper (Web Worker)
js/ui.js                Eval bar, chess helpers, book detection
js/progress.js          localStorage progress + spaced repetition
js/chesscom.js          Chess.com API + deviation finder + engine check
js/classify.js          Move labels (Masterstroke … Blunder) and their badges
js/views/*.js           One file per page
engine/stockfish.js     Stockfish 10 (asm.js build by Niklas Fiekas, GPL-3.0)
assets/                 Icons
tools/serve.ps1         Tiny local web server for Windows
docs/ROADMAP.md         Ideas and next steps
```

## Adding an opening

Edit `js/openings.js` and add an object:

```js
{
  id: 'my-opening',            // unique, never change it (progress is keyed by it)
  name: 'My Opening', eco: 'B00', side: 'w',   // side = the colour YOU play
  levels: ['beginner', 'intermediate'],          // beginner (<1000), intermediate (1000–1600),
                                                 // advanced (1600–2000), expert (2000+)
  levelNote: 'Why it suits those players.',
  description: 'One sentence about the plans.',
  lines: [
    { name: 'Main line', moves: 'e4 e5 Nf3 Nc6 Bb5' },   // SAN, space-separated, from the start position
  ],
}
```

Tip: end each line on **your** move, so the line finishes on something you played.

After editing, open **`/tools/validate.html`** (locally or on the live site, e.g. from your phone). It checks that every move is legal, ids are unique, levels are valid and lines end on your move.

## Credits & licence

This project is licensed under **GPL-3.0** (see `LICENSE`) because it ships Stockfish.

- **Engine**: [Stockfish](https://stockfishchess.org) 10 by T. Romstad, M. Costalba, J. Kiiski, G. Linscott and contributors (GPL-3.0),
  compiled to JavaScript by Niklas Fiekas ([stockfish.js](https://github.com/niklasf/stockfish.js), the source for `engine/stockfish.js`).
- **Move logic**: [chess.js](https://github.com/jhlywa/chess.js) by Jeff Hlywa (BSD-2-Clause), loaded from jsDelivr.
- **Piece sets** (shipped in `assets/pieces/`, copied from [lichess](https://github.com/lichess-org/lila/blob/master/COPYING.md); details in `assets/pieces/LICENSE.md`):
  - cburnett (the default, "Classic") by Colin M.L. Burnett and Merida by Armando Hernandez Marroquin: GPLv2+
  - Staunty, Maestro and Cardinal by sadsnake1: CC BY-NC-SA 4.0, **non-commercial only**. Remove them before adding ads, paid features or anything else commercial.
- **Game data**: your games come from the [Chess.com Published-Data API](https://www.chess.com/news/view/published-data-api). They are downloaded in your browser and never stored on a server.
- **Famous games**: the move scores are historical facts, checked against the source linked on each game. The descriptions and the move-by-move commentary (`js/game-notes.js`) are written for this site, paraphrasing the games' published annotations.
- **Opening notes**: the coach's explanations are written for this site. "Read more" links point to the original articles rather than copying them.
- **Design**: the colours, board themes, move labels and badges are this project's own. The move symbols (`!!`, `!`, `?!`, `?`, `??`) are the traditional chess annotation marks.

### Trademarks

Chess.com, Lichess and Stockfish are names of their respective owners. They are used here only to say where data comes from and which engine runs. This project is not affiliated with or endorsed by any of them.
