// Tiny hash router: #/  #/train/:id  #/analysis  #/progress  #/chesscom
import * as home from './views/home.js';
import * as trainer from './views/trainer.js';
import * as analysis from './views/analysis.js';
import * as progress from './views/progress.js';
import * as chesscom from './views/chesscom.js';
import * as quiz from './views/quiz.js';
import * as games from './views/games.js';
import * as punish from './views/punish.js';
import { applyTheme, openSettings } from './theme.js';
import { initCorner } from './corner.js';
import { initTutorial } from './tutorial.js';

applyTheme();
initCorner();
initTutorial();
document.getElementById('settingsBtn').addEventListener('click', openSettings);

const app = document.getElementById('app');
let cleanup = null;
let routed = false; // false until the first page has been shown

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  const parts = path.split('/').filter(Boolean);
  return { parts, query };
}

// ---------- back arrow ----------
// Every page gets a "← Back" button. It goes back through the pages you visited in this tab
// (history.state.n counts them); on a page you opened directly it goes up to the page's parent.
let depth = 0;
let goingUp = false; // the next page replaces this one (going up from a page opened directly)
function parentOf(parts, query) {
  if (parts[0] === 'games' && parts[1]) return '#/games';
  if (parts[0] === 'analysis' && query.review) return '#/chesscom';
  return '#/';
}
function backButton(parts, query) {
  const top = !parts.length || parts[0] === 'home';
  if (depth === 0 && top) return null; // the start page you opened: nowhere to go back to
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'backbtn';
  b.innerHTML = '<span aria-hidden="true">←</span> Back';
  b.addEventListener('click', () => {
    if (depth > 0) history.back();
    else { goingUp = true; location.replace(parentOf(parts, query)); }
  });
  return b;
}

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  app.innerHTML = '';
  const { parts, query } = parse();
  if (history.state && typeof history.state.n === 'number') depth = history.state.n; // back/forward
  else { if (routed && !goingUp) depth++; history.replaceState({ n: depth }, '', location.href); } // new page
  goingUp = false;
  routed = true;
  const back = backButton(parts, query);
  if (back) app.appendChild(back);
  let name = parts[0] || 'home';
  let result;
  switch (name) {
    case 'train': result = trainer.render(app, { id: parts[1], query }); name = 'home'; break;
    case 'quiz': result = quiz.render(app, { id: parts[1], query }); name = 'home'; break;
    case 'punish': result = punish.render(app, { id: parts[1], query }); name = 'home'; break;
    case 'games': result = games.render(app, { id: parts[1], query }); break;
    case 'analysis': result = analysis.render(app, { query }); break;
    case 'progress': result = progress.render(app, { query }); break;
    case 'chesscom': result = chesscom.render(app, { query }); break;
    default: name = 'home'; result = home.render(app, { query });
  }
  cleanup = result;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
