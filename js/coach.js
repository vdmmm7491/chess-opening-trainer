// The Coach: explains what a move does (rule-based, instant) and, for mistakes,
// uses Stockfish to show how the opponent can punish it.
import { Chess } from './ui.js';
import { NOTES } from './notes.js';
import { LINE_NOTES } from './line-notes.js';
import { LINE_NOTES_BLACK } from './line-notes-black.js';
import { LINE_NOTES_D4 } from './line-notes-d4.js';
import { ROUTINE_NOTES } from './notes-routine.js';
import { ROUTINE_NOTES_BLACK } from './notes-routine-black.js';
import { OPENINGS, lineMoves } from './openings.js';

/** All theory notes keyed by the SAN sequence. notes.js wins over per-line notes. */
export const THEORY = (() => {
  const map = {};
  const all = { ...LINE_NOTES, ...LINE_NOTES_D4, ...LINE_NOTES_BLACK };
  for (const o of OPENINGS) {
    (all[o.id] || []).forEach((entries, li) => {
      const mv = o.lines[li] ? lineMoves(o.lines[li]) : [];
      entries.forEach((e, i) => {
        const [san, ...rest] = e.split('|');
        const text = rest.join('|').trim();
        if (text && mv[i] === san) {
          const key = mv.slice(0, i + 1).join(' ');
          if (!map[key]) map[key] = text;
        }
      });
    });
  }
  return { ...map, ...ROUTINE_NOTES, ...ROUTINE_NOTES_BLACK, ...NOTES };
})();

const FILES = 'abcdefgh';
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const CENTER = ['d4', 'e4', 'd5', 'e5'];

const sqXY = (sq) => [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
const xySq = (x, y) => (x >= 0 && x < 8 && y >= 0 && y < 8 ? FILES[x] + (y + 1) : null);
const other = (c) => (c === 'w' ? 'b' : 'w');
const side = (c) => (c === 'w' ? 'White' : 'Black');

function pieceMap(chess) {
  const m = {};
  for (const row of chess.board()) for (const p of row) if (p) m[p.square] = { type: p.type, color: p.color };
  return m;
}

/** Squares attacked by the piece standing on `sq`. */
function attacksFrom(map, sq) {
  const p = map[sq];
  if (!p) return [];
  const [x, y] = sqXY(sq);
  const out = [];
  const add = (dx, dy) => { const s = xySq(x + dx, y + dy); if (s) out.push(s); };
  const ray = (dx, dy) => {
    for (let i = 1; i < 8; i++) {
      const s = xySq(x + dx * i, y + dy * i);
      if (!s) break;
      out.push(s);
      if (map[s]) break;
    }
  };
  switch (p.type) {
    case 'p': { const d = p.color === 'w' ? 1 : -1; add(-1, d); add(1, d); break; }
    case 'n': for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(dx, dy); break;
    case 'k': for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(dx, dy); break;
    case 'b': ray(1, 1); ray(1, -1); ray(-1, 1); ray(-1, -1); break;
    case 'r': ray(1, 0); ray(-1, 0); ray(0, 1); ray(0, -1); break;
    case 'q': ray(1, 1); ray(1, -1); ray(-1, 1); ray(-1, -1); ray(1, 0); ray(-1, 0); ray(0, 1); ray(0, -1); break;
  }
  return out;
}

function attackers(map, target, color) {
  return Object.keys(map).filter((s) => map[s].color === color && attacksFrom(map, s).includes(target));
}

function material(map, color) {
  return Object.values(map).reduce((a, p) => a + (p.type === 'k' ? 0 : (p.color === color ? 1 : -1) * VAL[p.type]), 0);
}

/** Pins created by a sliding piece on `sq`: enemy piece in front of a more valuable one. */
function pinsFrom(map, sq) {
  const p = map[sq];
  if (!p || !'brq'.includes(p.type)) return [];
  const dirs = [];
  if (p.type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  if (p.type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  const [x, y] = sqXY(sq);
  const out = [];
  for (const [dx, dy] of dirs) {
    let first = null;
    for (let i = 1; i < 8; i++) {
      const s = xySq(x + dx * i, y + dy * i);
      if (!s) break;
      const q = map[s];
      if (!q) continue;
      if (q.color === p.color) break;
      if (!first) { first = s; continue; }
      // Only meaningful pins: a piece (not a pawn) stuck in front of a rook, queen or king.
      if (map[first].type !== 'p' && 'rqk'.includes(q.type) && VAL[q.type] > VAL[map[first].type]) out.push({ pinned: first, behind: s });
      break;
    }
  }
  return out;
}

/**
 * Explain a move in plain words. Returns up to `max` short reasons, most important first.
 * @param {string} fen position before the move
 * @param {string} san the move
 * @param {{prev?: {to:string, captured?:string}}} ctx previous move (to recognise recaptures)
 */
export function explainMove(fen, san, ctx = {}, max = 3) {
  const c = new Chess(fen);
  let m;
  try { m = c.move(san); } catch { return []; }
  const before = pieceMap(new Chess(fen));
  const after = pieceMap(c);
  const us = m.color, them = other(us);
  const reasons = [];
  const say = (prio, text) => reasons.push({ prio, text });
  const piece = NAME[m.piece];
  const home = us === 'w' ? '1' : '8';

  if (c.isCheckmate()) return ['Checkmate! The game is over.'];
  if (m.flags.includes('k')) say(20, 'Castles kingside: the king is safe and the rook joins the game.');
  if (m.flags.includes('q')) say(20, 'Castles queenside: the king is safe and the rook lands on the open d-file.');
  if (!c.isCheckmate() && c.inCheck()) say(12, 'Gives check, so the opponent must respond to it.');

  // Captures
  if (m.captured) {
    const defended = attackers(after, m.to, them).length > 0;
    if (ctx.prev?.captured && ctx.prev.to === m.to) say(18, `Recaptures on ${m.to}, so material is level again.`);
    else if (!defended) say(19, `Wins the ${NAME[m.captured]} on ${m.to} for free.`);
    else if (VAL[m.captured] > VAL[m.piece]) say(17, `Wins material: the ${piece} takes a ${NAME[m.captured]}.`);
    else if (VAL[m.captured] < VAL[m.piece]) say(10, `Gives up the ${piece} for a ${NAME[m.captured]}, a sacrifice that only works if something bigger follows.`);
    else say(9, `Trades on ${m.to}.`);
    if (m.piece === 'p' && 'de'.includes(m.to[0]) && !'de'.includes(m.from[0])) say(8, 'Captures towards the centre.');
  }

  // Escaping an attack
  if (!m.captured && m.piece !== 'p' && attackers(before, m.from, them).length && !attackers(after, m.to, them).length) {
    say(14, `Moves the attacked ${piece} to safety.`);
  }

  // Development
  if ('nb'.includes(m.piece) && m.from[1] === home) {
    const central = attacksFrom(after, m.to).filter((s) => CENTER.includes(s)).length;
    say(11, `Develops the ${piece}${central ? ' towards the centre' : ''}.`);
  }
  if (m.piece === 'b' && ['g2', 'b2', 'g7', 'b7'].includes(m.to)) say(12, 'Fianchettoes the bishop onto the long diagonal, aiming at the centre.');
  if (m.piece === 'p' && !m.captured && ['g3', 'b3', 'g6', 'b6'].includes(m.to) && m.from[1] === (us === 'w' ? '2' : '7')) {
    say(7, `Prepares to fianchetto the bishop on ${m.to[0] === 'g' ? 'g' : 'b'}${us === 'w' ? '2' : '7'}.`);
  }

  // Pawn moves
  if (m.piece === 'p' && !m.captured) {
    if (CENTER.includes(m.to)) say(11, `Claims a central square (${m.to}).`);
    else if (['c4', 'c5', 'f4', 'f5'].includes(m.to)) say(8, 'Fights for the centre from the side.');
    else {
      const rank = Number(m.to[1]);
      if ((us === 'w' && rank >= 5) || (us === 'b' && rank <= 4)) say(6, `Gains space on the ${'abc'.includes(m.to[0]) ? 'queenside' : 'kingside'}.`);
    }
    // Opens a line for a bishop/queen
    if (['d2', 'e2', 'd7', 'e7'].includes(m.from)) {
      const bSq = us === 'w' ? (m.from[0] === 'e' ? 'f1' : 'c1') : (m.from[0] === 'e' ? 'f8' : 'c8');
      if (before[bSq]?.type === 'b' && before[bSq].color === us) say(4, `Opens a diagonal for the bishop on ${bSq}.`);
    }
    // Takes squares away from enemy pieces (a3, h3, a6, h6 ideas)
    const newly = attacksFrom(after, m.to).filter((s) => !attacksFrom(before, m.from).includes(s));
    for (const s of newly) {
      const intruders = attackers(before, s, them).filter((a) => 'nbq'.includes(before[a].type) && !before[s]);
      if (intruders.length) { say(7, `Takes ${s} away from the ${NAME[before[intruders[0]].type]}, so it can't jump there.`); break; }
    }
    // Gambit: the pawn just moved can be taken for free
    const attackersNow = attackers(after, m.to, them);
    if (attackersNow.length && !attackers(after, m.to, us).length) say(9, 'Offers the pawn as a gambit: speed and development matter more than one pawn.');
  }

  // Attacks, forks
  const targets = attacksFrom(after, m.to).filter((s) => after[s] && after[s].color === them && after[s].type !== 'k');
  const real = targets.filter((s) => {
    const t = after[s];
    const undefended = !attackers(after, s, them).length;
    return VAL[t.type] > VAL[m.piece] || undefended || (m.piece === 'p' && t.type === 'p');
  });
  const oldTargets = attacksFrom(before, m.from);
  const fresh = real.filter((s) => !oldTargets.includes(s));
  // Weak pawns defended only by the king (classic: f7 / f2)
  for (const s of targets.filter((x) => !oldTargets.includes(x) && after[x].type === 'p')) {
    const defs = attackers(after, s, them);
    if (defs.length === 1 && after[defs[0]].type === 'k') {
      const total = attackers(after, s, us).length;
      say(14, `${total >= 2 ? 'Doubles the attack on' : 'Attacks'} the pawn on ${s}, which only the king defends.`);
      break;
    }
  }
  if (fresh.length >= 2 && fresh.some((s) => VAL[after[s].type] >= 3)) {
    say(16, `Forks the ${fresh.slice(0, 2).map((s) => `${NAME[after[s].type]} on ${s}`).join(' and the ')}.`);
  } else if (fresh.length) {
    const s = fresh[0], t = after[s];
    if (m.piece === 'p' && t.type === 'p') say(8, `Challenges the pawn on ${s}.`);
    else if (VAL[t.type] > VAL[m.piece]) say(13, `Attacks the ${NAME[t.type]} on ${s} with a less valuable piece.`);
    else say(t.type === 'p' ? 9 : 10, `Attacks the undefended ${NAME[t.type]} on ${s}.`);
  }

  // Pins
  for (const pin of pinsFrom(after, m.to)) {
    say(13, `Pins the ${NAME[after[pin.pinned].type]} on ${pin.pinned} to the ${NAME[after[pin.behind].type]}.`);
    break;
  }

  // Defends a piece that is under attack
  for (const s of attacksFrom(after, m.to)) {
    const f = after[s];
    if (!f || f.color !== us || s === m.to || f.type === 'k') continue;
    if (attackers(after, s, them).length && !attackers(before, s, us).length) { say(10, `Defends the ${NAME[f.type]} on ${s}.`); break; }
  }

  // Clears the way to castle
  const kSq = us === 'w' ? 'e1' : 'e8';
  if (after[kSq]?.type === 'k' && m.piece !== 'k') {
    const r = us === 'w' ? '1' : '8';
    const between = (files) => files.every((f) => !after[f + r]);
    const wasBlocked = (files) => files.some((f) => before[f + r]);
    if (between(['f', 'g']) && wasBlocked(['f', 'g']) && after['h' + r]?.type === 'r') say(5, 'Clears the way to castle kingside.');
    else if (between(['b', 'c', 'd']) && wasBlocked(['b', 'c', 'd']) && after['a' + r]?.type === 'r') say(5, 'Clears the way to castle queenside.');
  }

  if (!reasons.length) say(1, m.piece === 'p' ? 'Improves the pawn structure.' : `Improves the ${piece}'s position.`);

  const seen = new Set();
  return reasons.sort((a, b) => b.prio - a.prio).filter((r) => !seen.has(r.text) && seen.add(r.text)).slice(0, max).map((r) => r.text);
}

/** Hand-written idea for the move that ends this SAN history, if we have one. */
export function noteFor(sans) {
  return THEORY[sans.join(' ')] || null;
}

const clamp = (v) => Math.max(-2000, Math.min(2000, v));

/**
 * Analyse a non-book move: how much it costs and how the opponent punishes it.
 * @param engine shared Engine
 * @param {string} fen position before the move
 * @param {string} playedSan the move the player made
 * @param {string[]} bookSans the repertoire move(s) for this position
 */
export async function analyseMistake(engine, fen, playedSan, bookSans, depth = 13) {
  const c = new Chess(fen);
  const us = c.turn();
  const sign = us === 'w' ? 1 : -1;
  const uci = (san) => { const t = new Chess(fen); const m = t.move(san); return m.from + m.to + (m.promotion || ''); };
  const playedUci = uci(playedSan);
  const book = await engine.analyse(fen, { depth, searchmoves: bookSans.map(uci) });
  if (book.cancelled) return null;
  const played = await engine.analyse(fen, { depth, searchmoves: [playedUci] });
  if (played.cancelled) return null;

  const score = (r) => clamp((r.info?.whiteCp ?? 0) * sign);
  const loss = Math.max(0, score(book) - score(played));
  const mateAgainst = played.info?.mate !== undefined && played.info.mate * sign < 0;

  // Replay the engine's line after the played move.
  const pv = (played.info?.pv || []).slice(1, 9);
  const steps = [];
  const t = new Chess(fen);
  const playedMove = t.move(playedSan);
  let prev = { to: playedMove.to, captured: playedMove.captured };
  for (const u of pv) {
    const before = t.fen();
    let m;
    try { m = t.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    steps.push({ san: m.san, from: m.from, to: m.to, color: m.color, fenAfter: t.fen(), why: explainMove(before, m.san, { prev }, 1)[0] || '' });
    prev = { to: m.to, captured: m.captured };
  }
  // Keep the line short: stop one move after the last capture/check (the "damage"), 2–8 plies.
  let lastHit = -1;
  steps.forEach((s, i) => { if (/[x+#]/.test(s.san)) lastHit = i; });
  const keep = lastHit >= 0 ? Math.min(steps.length, Math.max(2, lastHit + 2)) : Math.min(steps.length, 4);
  steps.length = keep;
  const end = new Chess(steps.length ? steps[steps.length - 1].fenAfter : fen);
  const startMat = material(pieceMap(new Chess(fen)), us);
  const endMat = material(pieceMap(end), us);

  return {
    loss, mateAgainst,
    kind: mateAgainst || loss >= 300 ? 'Blunder' : loss >= 150 ? 'Mistake' : loss >= 60 ? 'Inaccuracy' : 'Playable',
    materialChange: endMat - startMat,
    fenAfterPlayed: (() => { const x = new Chess(fen); x.move(playedSan); return x.fen(); })(),
    playedSan, bookSan: bookSans[0], us,
    steps,
  };
}

export function materialWords(n) {
  const v = Math.abs(n);
  if (v >= 9) return 'about a queen';
  if (v >= 5) return 'about a rook';
  if (v >= 3) return 'a piece';
  if (v >= 2) return 'two pawns';
  return 'a pawn';
}

export { side };
