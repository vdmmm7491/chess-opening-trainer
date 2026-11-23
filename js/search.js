// Opening search for the home page: matches names, ECO codes, descriptions, line names
// and move sequences ("e4 c5", "1.d4 d5 2.c4").

/** Lower-case, accents stripped ("López" -> "lopez"), dashes unified. */
export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[–—]/g, '-');
}

const SAN = /^(o-o(-o)?|[kqrbn]?[a-h]?[1-8]?x?[a-h][1-8](=?[qrbn])?)[+#]?$/i;

/** SAN moves typed in the query (move numbers dropped), or null if it isn't a move list. */
function queryMoves(q) {
  const toks = q.replace(/\d+\.(\.\.)?/g, ' ').replace(/0-0(-0)?/g, (m) => m.replace(/0/g, 'o')).trim().split(/\s+/).filter(Boolean);
  return toks.length && toks.every((t) => SAN.test(t)) ? toks.map((t) => t.replace(/[+#]$/, '').toLowerCase()) : null;
}

/** ECO code in "C60–C99" / "D02 / A48" ranges. */
function ecoMatch(eco, code) {
  return norm(eco).split(/[\/,]/).some((part) => {
    const [a, b = a] = part.split('-').map((x) => x.trim());
    return a && code[0] === a[0] && code >= a && code <= b;
  });
}

/**
 * Does opening `o` match query `q`? Returns null for no match, otherwise
 * { lines: [names of matching lines] } (empty when the opening itself matched).
 */
export function matchOpening(o, q) {
  const nq = norm(q).trim();
  if (!nq) return { lines: [] };

  const moves = queryMoves(nq);
  if (moves) {
    const hit = o.lines.filter((l) => {
      const lm = l.moves.split(/\s+/).map((m) => m.replace(/[+#]$/, '').toLowerCase());
      return moves.every((m, i) => lm[i] === m);
    });
    if (hit.length) return { lines: hit.length === o.lines.length ? [] : hit.map((l) => l.name) };
    // A single short token like "e4" may also just be text; fall through.
  }

  const words = nq.split(/\s+/);
  const head = norm([o.name, o.description, o.levelNote, ...(o.aliases || [])].join(' '));
  const wordOk = (w, text) => text.includes(w) || (/^[a-e]\d\d$/.test(w) && ecoMatch(o.eco, w));
  if (words.every((w) => wordOk(w, head))) return { lines: [] };
  // Words split between the opening and one of its lines ("italian evans").
  const hit = o.lines.filter((l) => words.every((w) => wordOk(w, head + ' ' + norm(l.name))));
  return hit.length ? { lines: hit.map((l) => l.name) } : null;
}
