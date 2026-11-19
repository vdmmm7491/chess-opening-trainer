// Look & feel: UI theme, board colours and piece set. Stored with the other settings.
import { getSettings, setSetting } from './progress.js';

export const PIECE_SETS = {
  staunty: 'Staunty',
  maestro: 'Maestro',
  cardinal: 'Cardinal',
  merida: 'Merida',
  governor: 'Governor',
  cburnett: 'Classic',
};

export const BOARD_THEMES = {
  green: { name: 'Green', light: '#ebecd0', dark: '#739552' },
  brown: { name: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  blue: { name: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  ice: { name: 'Ice', light: '#e8edf9', dark: '#b7c0d8' },
  purple: { name: 'Purple', light: '#efefef', dark: '#8877b7' },
  wood: { name: 'Walnut', light: '#e8c99b', dark: '#a6754a' },
};

export function pieceSet() {
  const s = getSettings().pieceSet;
  return PIECE_SETS[s] ? s : 'staunty';
}

export function applyTheme() {
  const s = getSettings();
  const board = BOARD_THEMES[s.boardTheme] || BOARD_THEMES.green;
  const root = document.documentElement;
  root.style.setProperty('--light-sq', board.light);
  root.style.setProperty('--dark-sq', board.dark);
  root.dataset.theme = s.uiTheme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.uiTheme === 'light' ? '#f4f2ee' : '#302e2b');
}

export function openSettings() {
  const s = getSettings();
  const dlg = document.createElement('dialog');
  dlg.className = 'settings';
  const opts = (obj, cur, label = (v) => v) =>
    Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${label(v)}</option>`).join('');
  dlg.innerHTML = `
    <form method="dialog">
      <h2>Appearance</h2>
      <label>Pieces<select class="input" name="pieceSet">${opts(PIECE_SETS, pieceSet())}</select></label>
      <div class="piece-preview"></div>
      <label>Board<select class="input" name="boardTheme">${opts(BOARD_THEMES, s.boardTheme || 'green', (v) => v.name)}</select></label>
      <label>Theme<select class="input" name="uiTheme">
        <option value="dark"${s.uiTheme !== 'light' ? ' selected' : ''}>Dark</option>
        <option value="light"${s.uiTheme === 'light' ? ' selected' : ''}>Light</option></select></label>
      <p class="muted" style="font-size:.85rem">Tip: right-click and drag on the board to draw arrows, right-click a square to highlight it.
        Hold Shift, Ctrl or Alt for other colours. Left-click clears them.</p>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary">Done</button></div>
    </form>`;
  document.body.appendChild(dlg);
  const preview = () => {
    const set = dlg.querySelector('[name=pieceSet]').value;
    dlg.querySelector('.piece-preview').innerHTML = ['wK', 'wQ', 'wN', 'bK', 'bQ', 'bN']
      .map((p, i) => `<span class="${i % 2 ? 'd' : 'l'}" style="background-image:url(https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/${set}/${p}.svg)"></span>`).join('');
  };
  dlg.addEventListener('change', (e) => {
    setSetting(e.target.name, e.target.value);
    applyTheme();
    preview();
    window.dispatchEvent(new Event('pieceset'));
  });
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  preview();
  dlg.showModal();
}
