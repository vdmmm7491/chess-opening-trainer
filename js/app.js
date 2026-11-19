// Tiny hash router: #/  #/train/:id  #/analysis  #/progress  #/chesscom
import * as home from './views/home.js';
import * as trainer from './views/trainer.js';
import * as analysis from './views/analysis.js';
import * as progress from './views/progress.js';
import * as chesscom from './views/chesscom.js';

const app = document.getElementById('app');
let cleanup = null;

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  const parts = path.split('/').filter(Boolean);
  return { parts, query };
}

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  app.innerHTML = '';
  const { parts, query } = parse();
  let name = parts[0] || 'home';
  let result;
  switch (name) {
    case 'train': result = trainer.render(app, { id: parts[1], query }); name = 'home'; break;
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
