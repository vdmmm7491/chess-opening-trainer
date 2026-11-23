import { OPENINGS, LEVELS, TIERS, TIER_KEYS, tierForLevel, linesFor } from '../openings.js';
import { openingProgress, dueCount, summary, getLevel, setLevel, getSettings, setSetting, quizUnlocked, linesLearned, QUIZ_UNLOCK } from '../progress.js';
import { h, esc, progressBar } from '../ui.js';
import { pieceUrl } from '../board.js';
import { PUNISH } from '../punish.js';

let sideFilter = 'all';

function levelBadges(o) {
  return (o.levels || []).map((k) => {
    const l = LEVELS[k];
    return l ? `<span class="lvl" style="--lvl:${l.color}" title="Suits ${esc(l.name)} players (${esc(l.range)} Elo)">${esc(l.name)}</span>` : '';
  }).join('');
}

/** Longest line at this level, in full moves. */
function depthAt(o, level) {
  const n = Math.max(0, ...linesFor(o, level).map((x) => x.moves.length));
  return Math.ceil(n / 2);
}

export function render(root) {
  const s = summary();
  let level = getLevel();

  root.appendChild(h(`<section>
    <h1>Practice your openings</h1>
    <p class="muted">Pick an opening, play your side from memory and get instant feedback.
      Lines you struggle with come back sooner (spaced repetition). ${s.streak ? `🔥 ${s.streak}-day streak.` : ''}</p>
  </section>`));

  const levelBox = h(`<div class="card level-box">
    <div class="level-head">
      <div><b>Your level</b> <span class="muted">Sets how deep every line goes. Higher levels learn more moves and more sidelines.</span></div>
    </div>
    <div class="level-chips">
      ${Object.entries(LEVELS).map(([k, l]) =>
        `<button class="level-chip" data-level="${k}" style="--lvl:${l.color}"><b>${esc(l.name)}</b><span class="level-range">${esc(l.range)} Elo</span><span>${l.upTo === Infinity ? 'Full lines' : `Up to move ${l.upTo}`}</span></button>`).join('')}
    </div>
    <p class="muted level-blurb"></p>
  </div>`);
  root.appendChild(levelBox);

  let tier = TIERS[getSettings().tier] ? getSettings().tier : tierForLevel(level);
  const tierBox = h(`<div class="card tier-box">
    <div class="tier-head"><b>Openings</b> <span class="muted">Slide to pick how hard the openings are.</span></div>
    <input type="range" class="tier-slider" min="0" max="${TIER_KEYS.length - 1}" step="1" aria-label="Opening tier">
    <div class="tier-labels">
      ${TIER_KEYS.map((k, i) => `<button class="tier-label" data-i="${i}" style="--tier:${TIERS[k].color}">${esc(TIERS[k].name)}</button>`).join('')}
    </div>
    <p class="muted tier-blurb"></p>
  </div>`);
  root.appendChild(tierBox);
  const slider = tierBox.querySelector('.tier-slider');

  const filters = h(`<div class="filters">
    <button class="btn small" data-f="all">All</button>
    <button class="btn small" data-f="w">As White</button>
    <button class="btn small" data-f="b">As Black</button>
  </div>`);
  root.appendChild(filters);
  const grid = h('<div class="grid"></div>');
  root.appendChild(grid);

  function draw() {
    levelBox.querySelectorAll('.level-chip').forEach((b) => b.classList.toggle('active', b.dataset.level === level));
    levelBox.querySelector('.level-blurb').textContent = LEVELS[level].blurb;
    filters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.f === sideFilter));
    const t = TIERS[tier], ti = TIER_KEYS.indexOf(tier);
    slider.value = ti;
    tierBox.style.setProperty('--tier', t.color);
    tierBox.style.setProperty('--tier-pos', `${(ti / (TIER_KEYS.length - 1)) * 100}%`);
    tierBox.querySelectorAll('.tier-label').forEach((b) => b.classList.toggle('active', +b.dataset.i === ti));
    tierBox.querySelector('.tier-blurb').textContent = t.blurb;
    grid.style.setProperty('--tier', t.color);

    grid.innerHTML = '';
    const list = OPENINGS.filter((o) => o.tier === tier && (sideFilter === 'all' || o.side === sideFilter));
    if (!list.length) grid.appendChild(h('<p class="muted">No openings for this side in this tier yet.</p>'));
    for (const o of list) {
      const p = openingProgress(o);
      const due = dueCount(o);
      const n = linesFor(o, level).length;
      grid.appendChild(h(`<article class="card opening-card">
        <div class="title"><div class="title-left"><span class="thumb ${o.side}" style="background-image:url(${pieceUrl(o.side, 'n')})"></span>
          <h3>${esc(o.name)}</h3></div><span class="tag ${o.side}">${o.side === 'w' ? 'White' : 'Black'}</span></div>
        <div class="lvl-row">${levelBadges(o)}</div>
        <p>${esc(o.description)}</p>
        ${o.levelNote ? `<p class="level-note">🎯 ${esc(o.levelNote)}</p>` : ''}
        <div class="kv"><span class="muted">${n} line${n === 1 ? '' : 's'} · up to move ${depthAt(o, level)} · <abbr title="Encyclopaedia of Chess Openings code: the standard catalogue number for this opening, used by opening books and databases" style="text-decoration:none;cursor:help">ECO ${esc(o.eco)}</abbr></span></div>
        ${progressBar(p)}
        <div class="btn-row">
          <a class="btn primary small" href="#/train/${o.id}?mode=practice">Practice${due ? ` (${due} due)` : ''}</a>
          <a class="btn small" href="#/train/${o.id}?mode=learn">Learn</a>
          ${quizUnlocked(o)
            ? `<a class="btn small" href="#/quiz/${o.id}">🧩 Quiz</a>`
            : `<a class="btn small locked" href="#/quiz/${o.id}" title="Complete ${QUIZ_UNLOCK} lines in Practice to unlock">🔒 Quiz ${linesLearned(o)}/${QUIZ_UNLOCK}</a>`}
          ${PUNISH[o.id]?.length ? `<a class="btn small" href="#/punish/${o.id}" title="Common opponent mistakes and how to punish them">⚔️ Punish</a>` : ''}
        </div>
      </article>`));
    }
  }

  levelBox.addEventListener('click', (e) => {
    const b = e.target.closest('.level-chip');
    if (b) { level = b.dataset.level; setLevel(level); draw(); }
  });
  const pickTier = (i) => {
    const k = TIER_KEYS[i];
    if (k && k !== tier) { tier = k; setSetting('tier', k); draw(); }
  };
  slider.addEventListener('input', () => pickTier(+slider.value));
  tierBox.addEventListener('click', (e) => {
    const b = e.target.closest('.tier-label');
    if (b) pickTier(+b.dataset.i);
  });
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { sideFilter = b.dataset.f; draw(); }
  });
  draw();
}
