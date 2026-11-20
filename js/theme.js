// Look & feel: UI theme, board colours and piece set. Stored with the other settings.
import { getSettings, setSetting } from './progress.js';

// cburnett and merida are GPLv2+ (compatible with this GPL-3.0 project). Staunty, Maestro and
// Cardinal are CC BY-NC-SA 4.0: fine while the site is non-commercial, but remove them before
// adding ads, paid features or anything else commercial (see assets/pieces/LICENSE.md).
export const PIECE_SETS = {
  cburnett: 'Classic',
  merida: 'Merida',
  staunty: 'Staunty (non-commercial licence)',
  maestro: 'Maestro (non-commercial licence)',
  cardinal: 'Cardinal (non-commercial licence)',
};
export const DEFAULT_PIECES = 'cburnett';

// Our own colour pairs (keys are kept so saved settings still work).
export const BOARD_THEMES = {
  slate: { name: 'Slate', light: '#dde3ea', dark: '#6f84a0' },
  green: { name: 'Forest', light: '#e7ecd6', dark: '#5f8a55' },
  brown: { name: 'Oak', light: '#eedcbf', dark: '#a87a52' },
  blue: { name: 'Sky', light: '#e3eef7', dark: '#7fa6c6' },
  ice: { name: 'Frost', light: '#eef2fa', dark: '#a9b5d2' },
  purple: { name: 'Lavender', light: '#ede9f5', dark: '#8b78b0' },
  wood: { name: 'Walnut', light: '#e6c9a0', dark: '#9b6c45' },
};
export const DEFAULT_BOARD = 'slate';

export function pieceSet() {
  const s = getSettings().pieceSet;
  return PIECE_SETS[s] ? s : DEFAULT_PIECES;
}

/** Piece animations: on unless switched off in Settings or the device asks for reduced motion. */
export function animationsOn() {
  if (getSettings().animations === 'off') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function applyTheme() {
  const s = getSettings();
  const board = BOARD_THEMES[s.boardTheme] || BOARD_THEMES[DEFAULT_BOARD];
  const root = document.documentElement;
  root.style.setProperty('--light-sq', board.light);
  root.style.setProperty('--dark-sq', board.dark);
  root.dataset.theme = s.uiTheme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.uiTheme === 'light' ? '#f3f5f9' : '#16181d');
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
      <label>Board<select class="input" name="boardTheme">${opts(BOARD_THEMES, BOARD_THEMES[s.boardTheme] ? s.boardTheme : DEFAULT_BOARD, (v) => v.name)}</select></label>
      <label>Theme<select class="input" name="uiTheme">
        <option value="dark"${s.uiTheme !== 'light' ? ' selected' : ''}>Dark</option>
        <option value="light"${s.uiTheme === 'light' ? ' selected' : ''}>Light</option></select></label>
      <label>Animations<select class="input" name="animations">
        <option value="on"${s.animations !== 'off' ? ' selected' : ''}>On</option>
        <option value="off"${s.animations === 'off' ? ' selected' : ''}>Off</option></select></label>
      <p class="muted" style="font-size:.85rem">Tip: right-click and drag on the board to draw arrows, right-click a square to highlight it.
        Hold Shift, Ctrl or Alt for other colours. Left-click clears them.</p>
      <div class="btn-row" style="justify-content:flex-end"><button class="btn primary">Done</button></div>
    </form>`;
  document.body.appendChild(dlg);
  const preview = () => {
    const set = dlg.querySelector('[name=pieceSet]').value;
    dlg.querySelector('.piece-preview').innerHTML = ['wK', 'wQ', 'wN', 'bK', 'bQ', 'bN']
      .map((p, i) => `<span class="${i % 2 ? 'd' : 'l'}" style="background-image:url(assets/pieces/${set}/${p}.svg)"></span>`).join('');
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
