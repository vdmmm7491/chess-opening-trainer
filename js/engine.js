// Thin wrapper around Stockfish (UCI) running in a Web Worker.
// Only one search runs at a time; a new request stops the current one.

const ENGINE_URL = new URL('../engine/stockfish.js', import.meta.url).href;

export class Engine {
  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.listeners = new Set();
    this.searching = false;
    this.queue = null; // next job waiting for the current search to stop
    this.current = null;
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
    this.send('setoption name Hash value 32');
    this.send('isready');
  }

  send(cmd) { this.worker.postMessage(cmd); }

  /**
   * Analyse a position. onInfo is called with {depth, cp, mate, pv, whiteCp} as the search deepens.
   * Resolves with {bestmove, info} when finished.
   * @param {string} fen
   * @param {{depth?:number, movetime?:number, onInfo?:Function}} opts
   */
  analyse(fen, opts = {}) {
    return new Promise((resolve) => {
      const job = { fen, opts, resolve, info: null, turn: fen.split(' ')[1] };
      if (this.searching) {
        if (this.queue) this.queue.resolve({ bestmove: null, info: null, cancelled: true });
        this.queue = job;
        this.send('stop');
      } else {
        this.start(job);
      }
    });
  }

  async start(job) {
    await this.ready;
    this.current = job;
    this.searching = true;
    this.send('position fen ' + job.fen);
    const { depth, movetime, searchmoves } = job.opts;
    const restrict = searchmoves ? ' searchmoves ' + searchmoves.join(' ') : '';
    if (movetime) this.send('go movetime ' + movetime + restrict);
    else this.send('go depth ' + (depth || 16) + restrict);
  }

  stop() {
    if (this.queue) { this.queue.resolve({ bestmove: null, info: null, cancelled: true }); this.queue = null; }
    if (this.searching) this.send('stop');
  }

  handle(line) {
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info') && line.includes(' pv ') && !this.queue) {
      const info = parseInfo(line, job.turn);
      if (info && !line.includes('multipv 2')) {
        job.info = info;
        job.opts.onInfo?.(info);
      }
    } else if (line.startsWith('bestmove')) {
      const bestmove = line.split(' ')[1];
      this.searching = false;
      this.current = null;
      job.resolve({ bestmove: bestmove === '(none)' ? null : bestmove, info: job.info, cancelled: !!this.queue });
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
  const info = { depth, pv };
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
