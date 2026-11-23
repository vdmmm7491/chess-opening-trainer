import { OPENINGS, LEVELS, TIERS, TIER_KEYS, tierForLevel, linesFor } from '../openings.js';
import { openingProgress, dueCount, summary, getLevel, setLevel, getSettings, setSetting, quizUnlocked, linesLearned, QUIZ_UNLOCK } from '../progress.js';
import { h, esc, progressBar } from '../ui.js';
import { pieceUrl } from '../board.js';
import { PUNISH } from '../punish.js';
import { animationsOn } from '../theme.js';
import { matchOpening } from '../search.js';

let sideFilter = 'all';
let lastSide = 'w'; // the side the White/Black toggle shows while "All" is selected
let query = ''; // opening search; while set, it searches every tier

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
    <div class="tier-control">
      <div class="tier-track">
        <div class="tier-fill"></div>
        ${TIER_KEYS.map((k, i) => `<span class="tier-stop" style="--p:${i / (TIER_KEYS.length - 1)}"></span>`).join('')}
        <div class="tier-thumb"></div>
        <input type="range" class="tier-slider" min="0" max="${TIER_KEYS.length - 1}" step="any" aria-label="Opening tier">
      </div>
      <div class="tier-labels">
        ${TIER_KEYS.map((k, i) => `<button class="tier-label" data-i="${i}" style="--tier:${TIERS[k].color}">${esc(TIERS[k].name)}</button>`).join('')}
      </div>
    </div>
    <p class="muted tier-blurb"></p>
  </div>`);
  root.appendChild(tierBox);
  const slider = tierBox.querySelector('.tier-slider');
  const track = tierBox.querySelector('.tier-track');
  const maxTier = TIER_KEYS.length - 1;
  let dragging = false;

  const filters = h(`<div class="filters">
    <button class="btn small" data-f="all">All</button>
    <button class="btn small side-toggle" data-f="side" title="Click to switch between White and Black"><span class="side-icon"></span><span class="side-name"></span><span class="side-swap" aria-hidden="true">⇄</span></button>
    <label class="search-box">
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" class="opening-search" placeholder="Search openings, ECO or moves (e4 c5)" aria-label="Search openings" autocomplete="off" spellcheck="false">
    </label>
  </div>`);
  const search = filters.querySelector('.opening-search');
  search.value = query;
  root.appendChild(filters);
  const grid = h('<div class="grid"></div>');
  root.appendChild(grid);

  function draw(animate = false) {
    levelBox.querySelectorAll('.level-chip').forEach((b) => b.classList.toggle('active', b.dataset.level === level));
    levelBox.querySelector('.level-blurb').textContent = LEVELS[level].blurb;
    const side = sideFilter === 'all' ? lastSide : sideFilter;
    const toggle = filters.querySelector('.side-toggle');
    filters.querySelector('[data-f="all"]').classList.toggle('active', sideFilter === 'all');
    toggle.classList.toggle('active', sideFilter !== 'all');
    toggle.classList.toggle('w', side === 'w');
    toggle.classList.toggle('b', side === 'b');
    toggle.setAttribute('aria-pressed', String(sideFilter !== 'all'));
    toggle.querySelector('.side-icon').style.backgroundImage = `url(${pieceUrl(side, 'k')})`;
    toggle.querySelector('.side-name').textContent = side === 'w' ? 'As White' : 'As Black';
    const t = TIERS[tier], ti = TIER_KEYS.indexOf(tier);
    if (!dragging) { slider.value = ti; track.style.setProperty('--p', ti / maxTier); }
    slider.setAttribute('aria-valuetext', t.name);
    tierBox.style.setProperty('--tier', t.color);
    tierBox.querySelectorAll('.tier-label').forEach((b) => b.classList.toggle('active', +b.dataset.i === ti));
    tierBox.querySelector('.tier-blurb').textContent = t.blurb;
    grid.style.setProperty('--tier', t.color);
    tierBox.classList.toggle('searching', !!query.trim());

    swapCards(animate);
  }

  /** The cards for the current tier and side. */
  function cards() {
    const out = [];
    const searching = !!query.trim();
    const found = new Map();
    const list = OPENINGS.filter((o) => {
      if (sideFilter !== 'all' && o.side !== sideFilter) return false;
      if (!searching) return o.tier === tier;
      const m = matchOpening(o, query);
      if (m) found.set(o.id, m);
      return !!m;
    });
    if (!list.length) {
      out.push(h(searching
        ? `<p class="muted">No openings match “${esc(query.trim())}”${sideFilter === 'all' ? '' : ' for this side'}.</p>`
        : '<p class="muted">No openings for this side in this tier yet.</p>'));
    }
    for (const o of list) {
      const m = found.get(o.id);
      const tierTag = searching && TIERS[o.tier] ? `<span class="tier-tag" style="--tier:${TIERS[o.tier].color}">${esc(TIERS[o.tier].name)}</span>` : '';
      const lineHits = m?.lines.length ? `<p class="line-hits">Lines: ${m.lines.slice(0, 4).map(esc).join(' · ')}${m.lines.length > 4 ? ` +${m.lines.length - 4} more` : ''}</p>` : '';
      const p = openingProgress(o);
      const due = dueCount(o);
      const n = linesFor(o, level).length;
      out.push(h(`<article class="card opening-card" style="--tier:${TIERS[o.tier]?.color || 'var(--border)'}">
        <div class="title"><div class="title-left"><span class="thumb ${o.side}" style="background-image:url(${pieceUrl(o.side, 'n')})"></span>
          <h3>${esc(o.name)}</h3></div><span class="tag ${o.side}">${o.side === 'w' ? 'White' : 'Black'}</span></div>
        <div class="lvl-row">${tierTag}${levelBadges(o)}</div>
        <p>${esc(o.description)}</p>
        ${lineHits}
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
    return out;
  }

  // Old cards fade and sink away, then the new ones rise in one after another. A newer
  // change while that runs wins (the stale run sees a different `gen` and stops).
  let gen = 0;
  async function swapCards(animate) {
    const my = ++gen;
    const old = [...grid.children];
    if (animate && animationsOn() && old.length) {
      await Promise.all(old.map((el, i) => el.animate(
        [{ opacity: 0, transform: 'translateY(10px) scale(0.96)' }],
        { duration: 160, delay: Math.min(i, 6) * 18, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})));
      if (my !== gen) return;
    }
    const fresh = cards();
    grid.replaceChildren(...fresh);
    if (!animate || !animationsOn()) return;
    fresh.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(16px) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, delay: i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }

  levelBox.addEventListener('click', (e) => {
    const b = e.target.closest('.level-chip');
    if (b) { level = b.dataset.level; setLevel(level); draw(); }
  });
  const pickTier = (i) => {
    const k = TIER_KEYS[i];
    if (k && k !== tier) { tier = k; setSetting('tier', k); draw(true); }
  };
  // The range input is invisible on top of the track: dragging moves the thumb freely
  // (switching tier as it passes the middle), releasing glides it to the nearest stop.
  let downX = null;
  slider.addEventListener('pointerdown', (e) => { downX = e.clientX; });
  slider.addEventListener('pointermove', (e) => {
    if (downX !== null && Math.abs(e.clientX - downX) > 3) { dragging = true; track.classList.add('dragging'); }
  });
  slider.addEventListener('input', () => {
    if (dragging) track.style.setProperty('--p', slider.value / maxTier);
    pickTier(Math.round(+slider.value));
    if (!dragging) draw(); // a click on the track: glide to the stop
  });
  const release = () => {
    downX = null;
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    draw(); // snaps --p to the tier's stop, with the transition
  };
  slider.addEventListener('change', release);
  slider.addEventListener('pointerup', release);
  slider.addEventListener('pointercancel', release);
  slider.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? maxTier : d !== undefined ? TIER_KEYS.indexOf(tier) + d : null;
    if (to === null) return;
    e.preventDefault();
    pickTier(Math.max(0, Math.min(maxTier, to)));
  });
  tierBox.addEventListener('click', (e) => {
    const b = e.target.closest('.tier-label');
    if (b) pickTier(+b.dataset.i);
  });
  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = search.value; draw(); }, 120);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = query = ''; draw(); }
  });
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.f === 'all') sideFilter = 'all';
    // First click picks the side it shows; after that each click swaps White <-> Black.
    else sideFilter = lastSide = sideFilter === 'all' ? lastSide : (sideFilter === 'w' ? 'b' : 'w');
    draw(true);
  });
  draw();
  return () => clearTimeout(searchTimer);
}
