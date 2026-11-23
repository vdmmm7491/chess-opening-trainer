# Roadmap / ideas

## Done (v0.1)
- [x] Trainer with Learn / Practice modes, spaced repetition, hints, "play on vs Stockfish"
- [x] Stockfish eval bar (in-browser worker)
- [x] Analysis board with best-move arrow, book detection, FEN/moves import
- [x] Progress page: streak, heatmap, mastery, history, export/import
- [x] Chess.com: opening stats, repertoire deviations, Stockfish opening check
- [x] Mobile + desktop layout, installable (web manifest)

## Next up
- [ ] **Custom repertoires**: let users build their own lines in the analysis board and save them (localStorage), then train them
- [ ] **Import a PGN repertoire** (e.g. a Lichess/Chessable study export) as a custom opening
- [ ] **Branching training**: when the opponent has several book replies, choose randomly (weighted by popularity)
- [ ] **Stronger engine**: Stockfish 16/17 "lite single-threaded" WASM build (NNUE) for much better opening evaluations. It needs the `.wasm` file next to the JS file.
- [ ] **Cloud sync of progress** (optional login). Ideas: Supabase/Firebase free tier, or a GitHub Gist as storage
- [ ] **Lichess account support** (lichess.org/api/games/user/{name}, NDJSON stream)
- [ ] Offline support with a service worker (PWA)
- [ ] Sounds for moves and captures, board/piece themes
- [ ] Keyboard move entry on desktop
- [ ] "Mistakes" deck: auto-create drills from Chess.com deviations and engine-check mistakes

## Known limitations
- Progress is stored per browser. Use Export/Import to move it between devices.
- The browser engine (Stockfish 19 lite, single-threaded) searches to modest depths, so the Chess.com engine check still
  treats each side's first 3 moves leniently and uses fairly high loss thresholds.
- The Chess.com deviation finder compares your games against the trainer's built-in repertoire, not your personal repertoire (yet).
