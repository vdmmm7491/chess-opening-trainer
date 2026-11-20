// Bottom-corner widget: a rotating master quote plus recommended reads.
// The quote changes every time the site is opened and every 15 minutes while it stays open.
import { QUOTES, BOOKS, RATINGS_SOURCE, RATINGS_CHECKED } from './quotes.js';

const QUOTE_KEY = 'opening-trainer.quote';   // { i, at }
const STATE_KEY = 'opening-trainer.corner';  // 'open' | 'min'
const ROTATE_MS = 15 * 60 * 1000;
const BOARD_ROUTES = new Set(['train', 'quiz', 'analysis']);

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

function nextIndex(prev) {
  if (QUOTES.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * QUOTES.length); } while (i === prev);
  return i;
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initCorner() {
  let saved = null;
  try { saved = JSON.parse(read(QUOTE_KEY)); } catch { /* ignore */ }
  // New visit -> new quote.
  let current = { i: nextIndex(saved?.i), at: Date.now() };
  write(QUOTE_KEY, JSON.stringify(current));

  const el = document.createElement('aside');
  el.className = 'corner';
  el.setAttribute('aria-label', 'Chess quote and recommended reads');
  el.innerHTML = `
    <button class="corner-fab" type="button" aria-label="Show quote and recommended reads" title="Quote &amp; reads">❝</button>
    <div class="corner-card card">
      <button class="corner-close" type="button" aria-label="Minimise" title="Minimise">–</button>
      <figure class="corner-quote">
        <blockquote></blockquote>
        <figcaption></figcaption>
      </figure>
      <details class="corner-books">
        <summary>📚 Recommended reads</summary>
        <ul>
          ${BOOKS.map((b) => `
            <li>
              <a href="${b.url}" target="_blank" rel="noopener">${esc(b.title)}</a>
              <span class="corner-meta">${esc(b.author)} · <span class="corner-star">★ ${b.rating.toFixed(1)}</span></span>
              <span class="corner-why">${esc(b.why)}</span>
            </li>`).join('')}
        </ul>
        <p class="corner-src">Average ratings on ${RATINGS_SOURCE}, ${RATINGS_CHECKED}.</p>
      </details>
    </div>`;
  document.body.insertBefore(el, document.querySelector('.footer'));

  const bq = el.querySelector('blockquote');
  const cap = el.querySelector('figcaption');
  const show = () => {
    const q = QUOTES[current.i];
    bq.textContent = `“${q.text}”`;
    cap.textContent = `— ${q.by}`;
  };
  show();

  // Rotate while the tab stays open (checked each minute so sleeping tabs catch up).
  setInterval(() => {
    if (Date.now() - current.at < ROTATE_MS) return;
    current = { i: nextIndex(current.i), at: Date.now() };
    write(QUOTE_KEY, JSON.stringify(current));
    show();
  }, 60 * 1000);

  // Open/minimised. On board screens it starts minimised so it never covers the coach.
  const setOpen = (open) => el.classList.toggle('min', !open);
  const routeName = () => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'home');
  const applyRoute = () => setOpen(!BOARD_ROUTES.has(routeName()) && read(STATE_KEY) !== 'min');
  applyRoute();
  window.addEventListener('hashchange', applyRoute);

  el.querySelector('.corner-fab').addEventListener('click', () => { setOpen(true); write(STATE_KEY, 'open'); });
  el.querySelector('.corner-close').addEventListener('click', () => { setOpen(false); write(STATE_KEY, 'min'); });
}
