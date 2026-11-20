// Shown on the Progress page, built from your Chess.com games (see recommend.js).
import { reviewHref } from '../chesscom.js';
import { mastery } from '../progress.js';
import { h, esc } from '../ui.js';
import { recommend, movesLabel, levelName } from '../recommend.js';

/** "What to learn next" card: the match-ups you lose most, and trainer openings that answer them. */
export function learnNextCard(games) {
  const { level, items } = recommend(games, { mastery });
  const card = h(`<div class="card learn-next" style="margin-top:12px">
    <h2 style="margin-top:0">What to learn next</h2>
    <p class="muted" style="margin-top:0">The openings you lose to most in these games, and what to study in the trainer to fix them${
      level ? ` (picked for your level: <b>${esc(levelName(level.level))}</b>, ~${level.rating})` : ''}.</p>
  </div>`);
  if (!items.length) {
    card.appendChild(h(`<p class="good">No weak spots: you score at least 60% against every opening you've met three times or more. 👏</p>`));
    return card;
  }
  const pct = (s) => Math.round(s * 100);
  const learnBtn = (o, extra = '') => {
    const m = Math.round(mastery(o) * 100);
    return `<a class="btn small" href="#/train/${o.id}">${m ? `Continue (${m}%)` : 'Start learning'}</a>${extra}`;
  };
  const html = items.slice(0, 4).map((it) => {
    const side = it.color === 'w' ? '⚪ As White' : '⚫ As Black';
    const vs = it.color === 'b' ? `vs ${esc(movesLabel(it.key))}` : `after ${esc(movesLabel(it.key))}`;
    const fams = it.families.map((f) => `${esc(f.name)} <span class="muted">(${f.L} lost)</span>`).join(', ');
    const reply = it.reply ? ` · you usually answer <b>${esc(movesLabel(it.reply, 1))}</b>` : '';
    const sugg = [];
    if (it.fix) {
      const o = it.fix.opening;
      sugg.push(`<li><span class="tag">Drill</span> <b>${esc(o.name)}</b> – ${esc(it.fix.line.name)}
        <div class="muted" style="font-size:.85rem">You already play this: your lost games left the line around move ${Math.floor(it.fix.depth / 2) + 1}. Drill it until it's automatic.</div>
        <div class="learn-actions"><a class="btn small primary" href="#/train/${o.id}?mode=practice&line=${it.fix.lineIdx}">Drill this line</a></div></li>`);
    }
    for (const a of it.alternatives) {
      const o = a.opening;
      const why = a.fits ? `suits ${esc(levelName(level?.level))} players` : `aimed at ${esc((o.levels || []).map(levelName).join(' / '))} players`;
      sugg.push(`<li><span class="tag">${it.avoid ? `Avoid ${esc(movesLabel(it.key.slice(1), 1))} with` : it.fix ? 'Or switch to' : 'Learn'}</span> <b>${esc(o.name)}</b> <span class="muted">· ${why}</span>
        <div class="muted" style="font-size:.85rem">${esc(o.levelNote || o.description || '')}</div>
        <div class="learn-actions">${learnBtn(o)}</div></li>`);
    }
    if (!sugg.length) {
      sugg.push(`<li class="muted">The trainer has no lines for this match-up yet – open your lost games on the <a href="#/chesscom">Review</a> tab to see where they went wrong.</li>`);
    }
    const worst = it.lost[0];
    return `<div class="learn-item">
      <div class="learn-head"><b>${side} ${vs}</b>
        <span class="muted">${it.n} games · ${it.W}W ${it.D}D <span class="bad">${it.L}L</span> · <span class="${pct(it.score) < 45 ? 'bad' : ''}">${pct(it.score)}%</span></span></div>
      ${fams ? `<div class="muted" style="font-size:.9rem">Lost in: ${fams}${reply}</div>` : ''}
      <ul class="learn-sugg">${sugg.join('')}</ul>
      ${worst ? `<a class="muted" style="font-size:.85rem" href="${esc(reviewHref(worst))}">Review your latest loss (vs ${esc(worst.opponent)}) ›</a>` : ''}
    </div>`;
  }).join('');
  card.appendChild(h(`<div>${html}</div>`));
  return card;
}

/** The quiet "Suggested" mark used on the Openings page and the Progress table. */
export const suggestMark = (why) => `<span class="suggest-mark" title="${esc(why)}"><i></i>Suggested</span>`;
