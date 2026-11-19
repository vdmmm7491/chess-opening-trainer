import { OPENINGS, LEVELS, levelForRating } from '../openings.js';
import { mastery, dueCount, summary, getSettings, setSetting } from '../progress.js';
import { h, esc } from '../ui.js';
import { pieceUrl } from '../board.js';

let sideFilter = 'all';

function levelBadges(o) {
  return (o.levels || []).map((k) => {
    const l = LEVELS[k];
    return l ? `<span class="lvl" style="--lvl:${l.color}" title="${esc(l.name)} (${esc(l.range)})">${esc(l.range)}</span>` : '';
  }).join('');
}

export function render(root) {
  const s = summary();
  const settings = getSettings();
  let level = LEVELS[settings.levelFilter] ? settings.levelFilter : 'all';

  root.appendChild(h(`<section>
    <h1>Practice your openings</h1>
    <p class="muted">Pick an opening, play your side from memory and get instant feedback.
      Lines you struggle with come back sooner (spaced repetition). ${s.streak ? `🔥 ${s.streak}-day streak.` : ''}</p>
  </section>`));

  const levelBox = h(`<div class="card level-box">
    <div class="level-head">
      <div><b>What's your rating?</b> <span class="muted">See the openings that suit your level.</span></div>
      <label class="rating-input muted">Rating <input class="input" type="number" inputmode="numeric" min="100" max="3500" step="50" placeholder="e.g. 850"></label>
    </div>
    <div class="level-chips">
      <button class="level-chip" data-level="all"><b>All levels</b><span>Every opening</span></button>
      ${Object.entries(LEVELS).map(([k, l]) =>
        `<button class="level-chip" data-level="${k}" style="--lvl:${l.color}"><b>${esc(l.name)}</b><span>${esc(l.range)}</span></button>`).join('')}
    </div>
  </div>`);
  root.appendChild(levelBox);
  const ratingEl = levelBox.querySelector('input');
  if (settings.rating) ratingEl.value = settings.rating;

  const filters = h(`<div class="filters">
    <button class="btn small" data-f="all">All</button>
    <button class="btn small" data-f="w">As White</button>
    <button class="btn small" data-f="b">As Black</button>
    <button class="btn small" data-f="due">Due for review</button>
  </div>`);
  root.appendChild(filters);
  const heading = h('<h2 class="level-title"></h2>');
  root.appendChild(heading);
  const grid = h('<div class="grid"></div>');
  root.appendChild(grid);

  function draw() {
    levelBox.querySelectorAll('.level-chip').forEach((b) => b.classList.toggle('active', b.dataset.level === level));
    filters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.f === sideFilter));
    const L = LEVELS[level];
    heading.innerHTML = L ? `Recommended for <span style="color:${L.color}">${esc(L.name)}</span> <span class="muted">(${esc(L.range)})</span>` : '';
    heading.hidden = !L;

    grid.innerHTML = '';
    const list = OPENINGS.filter((o) =>
      (level === 'all' || (o.levels || []).includes(level)) &&
      (sideFilter === 'all' || o.side === sideFilter || (sideFilter === 'due' && dueCount(o) > 0)));
    for (const o of list) {
      const m = Math.round(mastery(o) * 100);
      const due = dueCount(o);
      grid.appendChild(h(`<article class="card opening-card">
        <div class="title"><div class="title-left"><span class="thumb ${o.side}" style="background-image:url(${pieceUrl(o.side, 'n')})"></span>
          <h3>${esc(o.name)}</h3></div><span class="tag ${o.side}">${o.side === 'w' ? 'White' : 'Black'}</span></div>
        <div class="lvl-row">${levelBadges(o)}</div>
        <p>${esc(o.description)}</p>
        ${o.levelNote ? `<p class="level-note">🎯 ${esc(o.levelNote)}</p>` : ''}
        <div class="kv"><span class="muted">${o.lines.length} lines · ${esc(o.eco)}</span><span>${m}% mastered</span></div>
        <div class="bar"><span style="width:${m}%"></span></div>
        <div class="btn-row">
          <a class="btn primary small" href="#/train/${o.id}?mode=practice">Practice${due ? ` (${due} due)` : ''}</a>
          <a class="btn small" href="#/train/${o.id}?mode=learn">Learn</a>
        </div>
      </article>`));
    }
    if (!list.length) {
      grid.appendChild(h(sideFilter === 'due'
        ? '<p class="muted">Nothing due – great job! Come back tomorrow.</p>'
        : '<p class="muted">No openings match these filters yet.</p>'));
    }
  }

  function setLevel(k) {
    level = k;
    setSetting('levelFilter', k);
    draw();
  }

  levelBox.addEventListener('click', (e) => {
    const b = e.target.closest('.level-chip');
    if (b) setLevel(b.dataset.level);
  });
  ratingEl.addEventListener('input', () => {
    const r = Number(ratingEl.value);
    setSetting('rating', ratingEl.value);
    if (r >= 100) setLevel(levelForRating(r));
  });
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { sideFilter = b.dataset.f; draw(); }
  });
  draw();
}
