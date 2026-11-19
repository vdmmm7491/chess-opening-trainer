# Opening Trainer – notes for AI assistants

- Pure static site: plain ES modules, **no build step, no package.json**. Deployed with GitHub Pages from `main` / root.
- External deps are loaded from pinned CDN URLs: chess.js `1.0.0` (jsDelivr `+esm`) and lichess cburnett piece SVGs. Stockfish is vendored in `engine/stockfish.js` (asm.js, loaded as a same-origin Web Worker; GitHub Pages can't set COOP/COEP headers, so don't switch to a multi-threaded build).
- Routing is hash-based in `js/app.js`. Each view in `js/views/` exports `render(root, {id, query})` and may return a cleanup function.
- Only ONE shared engine instance (`getEngine()`). A new `analyse()` call stops the running search.
- Progress lives in localStorage under `opening-trainer.v1` and is keyed by `openingId:lineIndex`. Never rename opening ids or reorder existing lines; add new lines at the end.
- Every opening needs `levels` (keys of `LEVELS` in `js/openings.js`) and a one-sentence `levelNote`.
- Validate after editing `js/openings.js` by opening `tools/validate.html` (legal SAN, unique ids, valid levels, lines end on the trainee's move).
- Coach: `js/coach.js` has a rule-based `explainMove` (own attack/pin detection, no engine) and an engine-backed `analyseMistake` that compares two `searchmoves` searches from the same root. `js/notes.js` holds hand-written idea notes keyed by the full SAN move sequence. The validator checks the note keys.
- Local test server: `powershell -ExecutionPolicy Bypass -File tools/serve.ps1` (port 8080).
