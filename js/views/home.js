import { OPENINGS } from '../openings.js';
import { mastery, dueCount, summary } from '../progress.js';
import { h, esc } from '../ui.js';
import { pieceUrl } from '../board.js';

let filter = 'all';

export function render(root) {
  const s = summary();
  root.appendChild(h(`<section>
    <h1>Practice your openings</h1>
    <p class="muted">Pick an opening, play your side from memory and get instant feedback.
      Lines you struggle with come back sooner (spaced repetition). ${s.streak ? `🔥 ${s.streak}-day streak.` : ''}</p>
  </section>`));

  const filters = h(`<div class="filters">
    <button class="btn small" data-f="all">All</button>
    <button class="btn small" data-f="w">As White</button>
    <button class="btn small" data-f="b">As Black</button>
    <button class="btn small" data-f="due">Due for review</button>
  </div>`);
  root.appendChild(filters);
  const grid = h('<div class="grid"></div>');
  root.appendChild(grid);

  function draw() {
    filters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.f === filter));
    grid.innerHTML = '';
    const list = OPENINGS.filter((o) => filter === 'all' || o.side === filter || (filter === 'due' && dueCount(o) > 0));
    for (const o of list) {
      const m = Math.round(mastery(o) * 100);
      const due = dueCount(o);
      grid.appendChild(h(`<article class="card opening-card">
        <div class="title"><div class="title-left"><span class="thumb ${o.side}" style="background-image:url(${pieceUrl(o.side, 'n')})"></span>
          <h3>${esc(o.name)}</h3></div><span class="tag ${o.side}">${o.side === 'w' ? 'White' : 'Black'}</span></div>
        <p>${esc(o.description)}</p>
        <div class="kv"><span class="muted">${o.lines.length} lines · ${esc(o.eco)}</span><span>${m}% mastered</span></div>
        <div class="bar"><span style="width:${m}%"></span></div>
        <div class="btn-row">
          <a class="btn primary small" href="#/train/${o.id}?mode=practice">Practice${due ? ` (${due} due)` : ''}</a>
          <a class="btn small" href="#/train/${o.id}?mode=learn">Learn</a>
        </div>
      </article>`));
    }
    if (!list.length) grid.appendChild(h('<p class="muted">Nothing due – great job! Come back tomorrow.</p>'));
  }
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { filter = b.dataset.f; draw(); }
  });
  draw();
}
