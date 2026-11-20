// Win-rate-over-time line chart (inline SVG) for the Progress page.
import { h, esc } from '../ui.js';

const SERIES = [
  { key: 'all', name: 'All games', color: 'var(--series-1)' },
  { key: 'trained', name: 'Openings you trained', color: 'var(--series-2)' },
];
const H = 240, PAD = { l: 40, r: 118, t: 24, b: 30 };
const NARROW = 520; // below this width the end labels are dropped (the legend still names both lines)
const fmtDay = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtMonth = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
const pct = (s) => `${Math.round(s * 100)}%`;

/**
 * @param data result of improvement()
 * @param started ms of the first trainer session, or null
 * @returns {{el: HTMLElement, destroy: () => void}}
 */
export function winrateChart(data, started) {
  const { buckets, size } = data;
  const label = (b) => size === 'month' ? fmtMonth(b.start) : `${fmtDay(b.start)} – ${fmtDay(b.end - 1)}`;
  const series = SERIES.filter((s) => buckets.some((b) => b[s.key].score !== null));

  const el = h(`<div class="wr-chart">
    <div class="wr-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}
      ${started ? '<span><i class="wr-dash"></i>You started training</span>' : ''}</div>
    <div class="wr-plot"><div class="wr-tip" hidden></div></div>
    <details class="wr-table"><summary class="muted">Show as table</summary>
      <div class="table-wrap"><table><thead><tr><th>${size === 'month' ? 'Month' : 'Period'}</th><th>Games</th><th>W / D / L</th><th>Score</th><th>Trained openings</th></tr></thead><tbody>
      ${buckets.map((b) => `<tr><td>${esc(label(b))}</td><td>${b.all.n}</td><td>${b.all.W} / ${b.all.D} / ${b.all.L}</td>
        <td>${b.all.score === null ? '–' : pct(b.all.score)}</td>
        <td>${b.trained.n ? `${b.trained.score === null ? '–' : pct(b.trained.score)} <span class="muted">(${b.trained.n})</span>` : '–'}</td></tr>`).join('')}
      </tbody></table></div></details>
  </div>`);
  const plot = el.querySelector('.wr-plot'), tip = el.querySelector('.wr-tip');

  const t0 = Math.min(buckets[0].start, started ?? Infinity);
  const t1 = buckets[buckets.length - 1].end;
  let W = 0, svg = null;
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (s) => PAD.t + (1 - s) * (H - PAD.t - PAD.b);
  const mid = (b) => (b.start + b.end) / 2;

  function draw() {
    const w = plot.clientWidth;
    if (!w || w === W) return;
    W = w;
    PAD.r = W < NARROW ? 12 : 118;
    const grid = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line class="wr-grid${v === 0.5 ? ' half' : ''}" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="wr-axis" x="${PAD.l - 6}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join('');

    // x-axis ticks: up to ~6 bucket labels, evenly spaced
    const every = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor((W - PAD.l - PAD.r) / 80))));
    const ticks = buckets.filter((_, i) => i % every === 0).map((b) =>
      `<text class="wr-axis" x="${x(b.start)}" y="${H - 8}" text-anchor="middle">${esc(size === 'month' ? fmtMonth(b.start) : fmtDay(b.start))}</text>`).join('');

    let marker = '';
    if (started) {
      const sx = x(started);
      const anchor = sx > W - PAD.r - 60 ? 'end' : 'start';
      marker = `<rect class="wr-before" x="${PAD.l}" y="${PAD.t}" width="${Math.max(0, sx - PAD.l)}" height="${H - PAD.t - PAD.b}"/>
        <line class="wr-start" x1="${sx}" x2="${sx}" y1="${PAD.t - 6}" y2="${H - PAD.b}"/>
        <text class="wr-axis strong" x="${sx + (anchor === 'start' ? 6 : -6)}" y="${PAD.t - 10}" text-anchor="${anchor}">Started training · ${esc(fmtDay(started))}</text>`;
    }

    // One path per series, broken where a period has too few games.
    const ends = [];
    const lines = series.map((s) => {
      let d = '', pen = false, last = null;
      const dots = [];
      for (const b of buckets) {
        const v = b[s.key].score;
        if (v === null) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${x(mid(b)).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true; last = { b, v };
        dots.push(`<circle cx="${x(mid(b))}" cy="${y(v)}" r="4" fill="${s.color}" class="wr-dot"/>`);
      }
      if (last) ends.push({ s, y: y(last.v), v: last.v });
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots.join('')}`;
    }).join('');

    // Direct labels at the right edge, nudged apart so they don't overlap.
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    const endLabels = W < NARROW ? '' : ends.map((e) => `<text class="wr-label" x="${W - PAD.r + 8}" y="${e.y + 4}">${esc(e.s.name.replace('Openings you trained', 'Trained'))} ${pct(e.v)}</text>`).join('');

    plot.querySelector('svg')?.remove();
    svg = h(`<svg width="${W}" height="${H}" role="img" aria-label="Score per ${size === 'month' ? 'month' : 'period'} in your Chess.com games">
      ${marker}${grid}${ticks}${lines}${endLabels}
      <line class="wr-cross" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"/>
    </svg>`);
    plot.prepend(svg);
  }

  // Hover / touch: nearest period, crosshair + tooltip.
  function hover(e) {
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = null;
    for (const b of buckets) {
      const d = Math.abs(x(mid(b)) - px);
      if (!best || d < best.d) best = { b, d };
    }
    if (!best) return;
    const b = best.b, cx = x(mid(b));
    const cross = svg.querySelector('.wr-cross');
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    const row = (s) => {
      const v = b[s.key];
      return `<div><i style="background:${s.color}"></i>${s.name}: <b>${v.score === null ? (v.n ? `${v.n} game${v.n > 1 ? 's' : ''}, too few` : 'no games') : pct(v.score)}</b>${v.score !== null ? ` <span class="muted">${v.W}W ${v.D}D ${v.L}L</span>` : ''}</div>`;
    };
    tip.innerHTML = `<div class="muted">${esc(label(b))}${started && b.end <= started ? ' · before training' : ''}</div>${series.map(row).join('')}`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, cx - tw / 2), W - tw)}px`;
  }
  const leave = () => { tip.hidden = true; svg?.querySelector('.wr-cross')?.setAttribute('visibility', 'hidden'); };
  plot.addEventListener('pointermove', hover);
  plot.addEventListener('pointerdown', hover);
  plot.addEventListener('pointerleave', leave);

  const ro = new ResizeObserver(draw);
  ro.observe(plot);
  return { el, destroy: () => ro.disconnect() };
}
