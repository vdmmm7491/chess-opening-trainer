// Thin wrapper around Stockfish (UCI) running in a Web Worker.
// Only one search runs at a time; a new request stops the current one.

// Stockfish 19 lite (NNUE), single-threaded WebAssembly: needs no SharedArrayBuffer, so it works on
// GitHub Pages without COOP/COEP headers. The old asm.js Stockfish 10 build is the fallback for
// browsers without WebAssembly.
const WASM_URL = new URL('../engine/stockfish-19-lite-single.js', import.meta.url).href;
const ASM_URL = new URL('../engine/stockfish.js', import.meta.url).href;
const ENGINE_URL = typeof WebAssembly === 'object' ? WASM_URL : ASM_URL;

export class Engine {
  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.listeners = new Set();
    this.searching = false;
    this.queue = null; // next job waiting for the current search to stop
    this.current = null;
    this.multipv = 1;
    this.ready = new Promise((resolve) => {
      const onReady = (line) => { if (line === 'readyok') { this.listeners.delete(onReady); resolve(); } };
      this.listeners.add(onReady);
    });
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const l of [...this.listeners]) l(line);
      this.handle(line);
    };
    this.send('uci');
    this.send('setoption name Hash value 64');
    this.send('isready');
  }

  send(cmd) { this.worker.postMessage(cmd); }

  /**
   * Analyse a position. onInfo is called with {depth, cp, mate, pv, whiteCp} as the search deepens.
   * Resolves with {bestmove, info, lines} when finished; `lines[i]` is the info for the (i+1)-th best
   * move when opts.multipv > 1 (lines[0] === info).
   * @param {string} fen
   * @param {{depth?:number, movetime?:number, multipv?:number, searchmoves?:string[], onInfo?:Function}} opts
   */
  analyse(fen, opts = {}) {
    return new Promise((resolve) => {
      const job = { fen, opts, resolve, info: null, lines: [], turn: fen.split(' ')[1], sent: false };
      if (this.current && !this.current.sent) {
        // Still waiting for the engine to load: nothing was sent yet, so just swap the job.
        this.current.resolve({ bestmove: null, info: null, cancelled: true });
        this.current = job;
      } else if (this.searching) {
        if (this.queue) this.queue.resolve({ bestmove: null, info: null, cancelled: true });
        this.queue = job;
        this.send('stop');
      } else {
        this.start(job);
      }
    });
  }

  // Marks the engine busy right away (not only once it has loaded), so two searches can never run
  // into each other: before, a second request during start-up started a parallel search and the
  // two got each other's results.
  start(job) {
    this.current = job;
    this.searching = true;
    // Send whatever job is current by then: a newer request may have replaced this one.
    this.ready.then(() => { if (this.current && !this.current.sent) this.sendJob(this.current); });
  }

  sendJob(job) {
    job.sent = true;
    const { depth, movetime, searchmoves, multipv = 1 } = job.opts;
    if (multipv !== this.multipv) { this.send('setoption name MultiPV value ' + multipv); this.multipv = multipv; }
    this.send('position fen ' + job.fen);
    const restrict = searchmoves ? ' searchmoves ' + searchmoves.join(' ') : '';
    if (movetime) this.send('go movetime ' + movetime + restrict);
    else this.send('go depth ' + (depth || 16) + restrict);
  }

  stop() {
    if (this.queue) { this.queue.resolve({ bestmove: null, info: null, cancelled: true }); this.queue = null; }
    if (this.current && !this.current.sent) {
      this.current.resolve({ bestmove: null, info: null, cancelled: true });
      this.current = null;
      this.searching = false;
    } else if (this.searching) this.send('stop');
  }

  handle(line) {
    const job = this.current;
    if (!job || !job.sent) return;
    if (line.startsWith('info') && line.includes(' pv ') && !this.queue) {
      const info = parseInfo(line, job.turn);
      if (info) {
        const idx = (info.multipv || 1) - 1;
        job.lines[idx] = info;
        if (idx === 0) { job.info = info; job.opts.onInfo?.(info); }
      }
    } else if (line.startsWith('bestmove')) {
      const bestmove = line.split(' ')[1];
      this.searching = false;
      this.current = null;
      job.resolve({ bestmove: bestmove === '(none)' ? null : bestmove, info: job.info, lines: job.lines, cancelled: !!this.queue });
      if (this.queue) {
        const next = this.queue;
        this.queue = null;
        this.start(next);
      }
    }
  }

  terminate() { this.worker.terminate(); }
}

function parseInfo(line, turn) {
  const t = line.split(' ');
  const get = (k) => { const i = t.indexOf(k); return i >= 0 ? t[i + 1] : undefined; };
  const depth = Number(get('depth'));
  const si = t.indexOf('score');
  if (si < 0) return null;
  const kind = t[si + 1];
  const val = Number(t[si + 2]);
  const pvIdx = t.indexOf('pv');
  const pv = pvIdx >= 0 ? t.slice(pvIdx + 1) : [];
  const sign = turn === 'w' ? 1 : -1;
  const info = { depth, pv, multipv: Number(get('multipv')) || 1 };
  if (kind === 'mate') {
    info.mate = val * sign; // positive = white mates
    info.whiteCp = (val > 0 ? 10000 : -10000) * sign;
  } else {
    info.cp = val * sign;
    info.whiteCp = val * sign;
  }
  return info;
}

/** Format an evaluation from White's point of view. */
export function formatEval(info) {
  if (!info) return '0.0';
  if (info.mate !== undefined) return (info.mate > 0 ? '+M' : '-M') + Math.abs(info.mate);
  const v = info.cp / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

let shared = null;
/** One shared engine for the whole app (saves memory on phones). */
export function getEngine() {
  if (!shared) shared = new Engine();
  return shared;
}
