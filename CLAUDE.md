# Opening Trainer – notes for AI assistants

- Pure static site: plain ES modules, **no build step, no package.json**. Deployed with GitHub Pages from `main` / root.
- External deps are loaded from pinned CDN URLs: chess.js `1.0.0` (jsDelivr `+esm`) and lichess cburnett piece SVGs. Stockfish is vendored in `engine/stockfish.js` (asm.js, loaded as a same-origin Web Worker; GitHub Pages can't set COOP/COEP headers, so don't switch to a multi-threaded build).
- Routing is hash-based in `js/app.js`. Each view in `js/views/` exports `render(root, {id, query})` and may return a cleanup function.
- Game review: `#/analysis?review=w|b&moves=…` (built by `reviewHref` in `js/chesscom.js`) runs `engineCheck` on the game, then explains the worst move with `analyseMistake`. Results are cached per game URL in `reviewCache`, which the Chess.com tab's "Recent games" list also reads.
- Only ONE shared engine instance (`getEngine()`). A new `analyse()` call stops the running search.
- `Board.setFen()` animates by diffing the old and new position (slides, check/mate/promotion effects; captures have no effect). Pass the real `lastMove` so promotions pair up; it can be switched off in Settings → Animations and respects prefers-reduced-motion.
- Progress lives in localStorage under `opening-trainer.v1` and is keyed by `openingId:lineIndex`. Never rename opening ids or reorder existing lines; add new lines at the end.
- Every opening needs `levels` (keys of `LEVELS` in `js/openings.js`) and a one-sentence `levelNote`.
- Validate after editing `js/openings.js` by opening `tools/validate.html` (legal SAN, unique ids, valid levels, lines end on the trainee's move).
- Coach (trainer only): theory notes for every book move live in `js/line-notes.js` (Italian, Ruy, Scotch), `js/line-notes-d4.js` (QG, London, English, Vienna) and `js/line-notes-black.js`. Each is an array per line of `"SAN|note"` entries aligned with the line's moves (bare `"SAN"` = explained elsewhere). `js/notes.js`, `js/notes-routine.js` and `js/notes-routine-black.js` hold overriding notes keyed by the full SAN sequence (the routine files give fuller, position-specific reasons for castling, recaptures and so on). `coach.js` merges them into `THEORY`. When you add a line, add its notes too; the validator reports misaligned entries and moves without notes. The rule-based `explainMove` is only a fallback and is used to describe the engine's refutation moves.
- Local test server: `powershell -ExecutionPolicy Bypass -File tools/serve.ps1` (port 8080).
