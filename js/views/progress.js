import { OPENINGS, getOpening } from '../openings.js';
import { summary, mastery, lineStats, activityDays, history, exportJson, importJson, resetAll, today } from '../progress.js';
import { h, esc } from '../ui.js';

export function render(root) {
  const s = summary();
  root.appendChild(h(`<section>
    <h1>Your progress</h1>
    <div class="stats">
      <div class="card stat"><div class="n">${s.streak}</div><div class="l">day streak 🔥</div></div>
      <div class="card stat"><div class="n">${s.attempts}</div><div class="l">lines practised</div></div>
      <div class="card stat"><div class="n">${Math.round(s.accuracy * 100)}%</div><div class="l">perfect runs</div></div>
      <div class="card stat"><div class="n">${s.learned}</div><div class="l">lines learned (level 3+)</div></div>
    </div>
  </section>`));

  // Activity heatmap – last 18 weeks
  const days = activityDays();
  const heat = h('<div class="heat"></div>');
  const d = new Date();
  d.setDate(d.getDate() - 125);
  for (let i = 0; i < 126; i++) {
    d.setDate(d.getDate() + 1);
    const n = days[today(d)] || 0;
    const lvl = n === 0 ? '' : n < 3 ? 'h1' : n < 6 ? 'h2' : n < 10 ? 'h3' : 'h4';
    heat.appendChild(h(`<span class="${lvl}" title="${today(d)}: ${n} lines"></span>`));
  }
  const act = h('<div class="card"><h2 style="margin-top:0">Activity</h2></div>');
  act.appendChild(heat);
  root.appendChild(act);

  // Per-opening table
  const rows = OPENINGS.map((o) => {
    const m = Math.round(mastery(o) * 100);
    const lines = o.lines.map((l, i) => {
      const st = lineStats(o.id, i);
      const due = st && st.due > Date.now() ? `review in ${Math.ceil((st.due - Date.now()) / 86400000)}d` : '<span class="warn">due</span>';
      return `<div class="kv"><a href="#/train/${o.id}?mode=practice&line=${i}">${esc(l.name)}</a>
        <span class="muted">${st ? `lvl ${st.box}/5 · ${st.perfect}/${st.attempts} perfect · ${due}` : 'not started'}</span></div>`;
    }).join('');
    return `<tr><td><b>${esc(o.name)}</b> <span class="tag ${o.side}">${o.side === 'w' ? 'W' : 'B'}</span>
      <div class="bar" style="margin-top:6px"><span style="width:${m}%"></span></div>
      <details style="margin-top:6px"><summary class="muted">Lines</summary>${lines}</details></td>
      <td style="width:70px">${m}%</td></tr>`;
  }).join('');
  root.appendChild(h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Openings</h2>
    <div class="table-wrap"><table><thead><tr><th>Opening</th><th>Mastery</th></tr></thead><tbody>${rows}</tbody></table></div></div>`));

  // Recent history
  const hist = history().slice(0, 15).map((e) => {
    const o = getOpening(e.id);
    if (!o) return '';
    return `<tr><td>${new Date(e.t).toLocaleString()}</td><td>${esc(o.name)} – ${esc(o.lines[e.line]?.name || '')}</td>
      <td class="${e.mistakes ? 'bad' : 'good'}">${e.mistakes ? e.mistakes + ' mistake' + (e.mistakes > 1 ? 's' : '') : 'perfect'}</td></tr>`;
  }).join('');
  root.appendChild(h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Recent sessions</h2>
    ${hist ? `<div class="table-wrap"><table><tbody>${hist}</tbody></table></div>` : '<p class="muted">No sessions yet – go practise an opening!</p>'}</div>`));

  // Backup / sync between devices
  const backup = h(`<div class="card" style="margin-top:12px"><h2 style="margin-top:0">Backup &amp; move between devices</h2>
    <p class="muted">Progress is saved in this browser. Export it to a file and import it on your phone/computer to sync.</p>
    <div class="btn-row">
      <button class="btn small" data-act="export">⬇ Export</button>
      <label class="btn small">⬆ Import<input type="file" accept="application/json" hidden></label>
      <button class="btn small" data-act="reset">Reset all progress</button>
    </div></div>`);
  root.appendChild(backup);
  backup.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'export') {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `opening-trainer-progress-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (b.dataset.act === 'reset' && confirm('Delete all progress on this device? This cannot be undone.')) {
      resetAll(); location.reload();
    }
  });
  backup.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { importJson(await f.text()); location.reload(); }
    catch (err) { alert('Import failed: ' + err.message); }
  });
}
