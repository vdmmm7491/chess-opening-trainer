// Guided tour: the bottom-left "Tutorial" button walks through the site. It opens each page,
// moves a pointer onto the buttons it presses, and outlines each feature while a card explains it.
// It starts by itself the first time someone visits.
import { OPENINGS } from './openings.js';

const SEEN_KEY = 'opening-trainer.tutorial-seen';
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const firstWhite = OPENINGS.find((o) => o.side === 'w') || OPENINGS[0];
let trainHash = `#/train/${firstWhite.id}?mode=learn`;   // updated to whichever card the tour clicks

/* Step fields:
   route   hash to show (string or function); the tour navigates there first
   target  selector(s) to outline; the first visible match wins (none = centred card)
   click   true: "Next" moves the pointer onto the target and clicks it
   open    selector the pointer clicks before outlining (only if visible, e.g. the phone line sheet)
   close   selector clicked when leaving the step (only if visible) */
const STEPS = [
  { route: '#/', title: 'Welcome to Opening Trainer 👋',
    text: 'This short tour opens every part of the site and shows you what it does. Use <b>Next</b> and <b>Back</b>, or the arrow keys. Press <b>Esc</b> to stop.' },
  { route: '#/', target: '.level-box', title: 'Pick your level',
    text: 'Choose your level: Beginner, Amateur, Intermediate or Advanced. It sets how deep every line goes, from the first 6 moves up to the full master lines, and which sidelines you learn.' },
  { route: '#/', target: '.filters', title: 'White or Black',
    text: 'Show only the openings you play as White, as Black, or all of them.' },
  { route: '#/', target: '.opening-card', title: 'An opening card',
    text: 'Each card shows the opening, the levels it suits, why it suits them and how much of it you have mastered. <b>Practice</b> tests you, <b>Learn</b> shows the moves, and <b>Quiz</b> unlocks after 2 lines in Practice.' },
  { route: '#/', target: '.opening-card a[href*="mode=learn"]', click: true, title: 'Let\'s open Learn mode',
    text: 'Press <b>Next</b> and I\'ll click <b>Learn</b> to open the trainer for this opening.' },
  { route: () => trainHash, target: '.board-wrap', title: 'The board',
    text: 'You play your side; the opponent\'s moves are played for you. In Learn mode an arrow shows the next book move. Right-click and drag to draw your own arrows, right-click a square to highlight it.' },
  { route: () => trainHash, target: '.side .card .btn-row', title: 'Learn, Practice and Quiz',
    text: '<b>Learn</b> shows each move. <b>Practice</b> tests you from memory; two wrong tries reveal the answer, and lines you miss come back sooner. <b>Quiz</b> asks for the book move in 10 random positions.' },
  { route: () => trainHash, target: '.lines-card', open: '.line-current', close: '.lines-card.open .lines-close', title: 'Choose a line',
    text: 'Every opening has several lines, including the opponent\'s common alternatives. Pick any line here; new lines are marked so you know what is left.' },
  { route: () => trainHash, target: '.coach', title: 'The coach',
    text: 'The coach explains the idea behind every book move. Play a wrong move and it shows how the opponent punishes it, then lets you try again. Switch it off with the toggle.' },
  { route: () => trainHash, target: '.card.btn-row:has([data-act])', title: 'Trainer buttons',
    text: '<b>Hint</b>, <b>Restart</b> and <b>Next line</b>. When the line ends, <b>▶ Play on</b> keeps the game going against Stockfish, and <b>🔍 Analyse</b> takes the position to the analysis board.' },
  { route: () => trainHash, target: '.eval-row', title: 'Evaluation bar',
    text: 'Turn on the Stockfish evaluation bar to see who is better. The engine\'s best line stays hidden in Practice so it doesn\'t give the answer away.' },
  { route: () => trainHash, target: '#nav a[data-route="games"]', click: true, title: 'Famous games',
    text: 'Next I\'ll open the <b>Famous Games</b> tab.' },
  { route: '#/games', target: '.game-card', title: 'Replay classic games',
    text: 'Famous games played in the openings you practise. Replay them move by move with the key moments explained and the Stockfish evaluation, or jump to the matching opening.' },
  { route: '#/games', target: '#nav a[data-route="analysis"]', click: true, title: 'Analysis board',
    text: 'Now the <b>Analysis</b> tab.' },
  { route: '#/analysis', target: '.play-layout', title: 'Analyse any position',
    text: 'A free board with Stockfish: best-move arrow, engine line and book detection. Paste a FEN or a move list, or play against the engine.' },
  { route: '#/analysis', target: '#nav a[data-route="progress"]', click: true, title: 'Your progress',
    text: 'Next, the <b>Profile</b> tab.' },
  { route: '#/progress', target: '.stats', title: 'Track your training',
    text: 'Your streak and totals, then an activity heatmap, mastery for every opening and line, and your recent sessions.' },
  { route: '#/progress', target: '.backup-card', title: 'Backup',
    text: 'Progress is saved in this browser. Export it here and import it on another device to carry on there.' },
  { route: '#/progress', target: '#nav a[data-route="chesscom"]', click: true, title: 'Chess.com review',
    text: 'Last tab: <b>Review</b>.' },
  { route: '#/chesscom', target: '.form-row', title: 'Review your real games',
    text: 'Enter your Chess.com username to see your results by opening, the moves where you left your repertoire (with a button to drill that line) and the opening moves that cost you the most.' },
  { route: '#/', target: '#settingsBtn', title: 'Appearance',
    text: 'The ⚙ button changes the piece set, the board colours and the light or dark theme.' },
  { route: '#/', target: '.corner', title: 'Quotes & reads',
    text: 'A quote from a chess master, and a list of recommended books.' },
  { route: '#/', target: '.tutorial-fab', title: 'That\'s everything!',
    text: 'Press <b>Tutorial</b> any time to see this tour again. Good luck with your openings!' },
];

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
function find(sel) {
  if (!sel) return null;
  for (const s of [].concat(sel)) {
    let list;
    try { list = document.querySelectorAll(s); } catch { continue; }   // e.g. :has() unsupported
    const el = [...list].find(visible);
    if (el) return el;
  }
  return null;
}
async function waitFor(sel, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const el = find(sel);
    if (el) return el;
    await wait(80);
  }
  return null;
}

let tour = null;   // the running tour, if any

export function startTour() {
  if (tour) return;
  const layer = document.createElement('div');
  layer.className = 'tour';
  layer.innerHTML = `
    <div class="tour-block"></div>
    <div class="tour-spot"></div>
    <div class="tour-cursor" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28">
      <path d="M5 2l14 11.5-6.3.7 3.8 7.4-2.9 1.4-3.7-7.5L5 20z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
    <div class="tour-card card" role="dialog" aria-live="polite" aria-labelledby="tourTitle">
      <div class="tour-count muted"></div>
      <h3 id="tourTitle"></h3>
      <p class="tour-text"></p>
      <div class="tour-btns">
        <button class="btn small tour-skip" type="button">End tour</button>
        <span style="flex:1"></span>
        <button class="btn small tour-back" type="button">Back</button>
        <button class="btn small primary tour-next" type="button">Next</button>
      </div>
    </div>`;
  document.body.appendChild(layer);
  const $ = (s) => layer.querySelector(s);
  const spot = $('.tour-spot'), card = $('.tour-card'), cursor = $('.tour-cursor');

  tour = { i: -1, target: null, busy: false, raf: 0 };

  // Keep the outline and the card glued to the target while the page scrolls or resizes.
  const place = () => {
    const el = tour.target;
    const vw = innerWidth, vh = innerHeight, pad = 6, gap = 12;
    const cw = Math.min(360, vw - 24);
    card.style.width = `${cw}px`;
    const ch = card.offsetHeight;
    if (!el || !el.isConnected) {
      spot.classList.add('empty');
      spot.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
      card.style.left = `${(vw - cw) / 2}px`;
      card.style.top = `${Math.max(12, (vh - ch) / 2)}px`;
    } else {
      const r = el.getBoundingClientRect();
      spot.classList.remove('empty');
      spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;opacity:1`;
      const below = vh - r.bottom - pad - gap, above = r.top - pad - gap;
      let top;
      if (below >= ch) top = r.bottom + pad + gap;
      else if (above >= ch) top = r.top - pad - gap - ch;
      else top = vh - ch - 12;   // no room either side: sit at the bottom of the screen
      let left = r.left + r.width / 2 - cw / 2;
      left = Math.max(12, Math.min(left, vw - cw - 12));
      card.style.left = `${left}px`;
      card.style.top = `${Math.max(12, top)}px`;
    }
    tour.raf = requestAnimationFrame(place);
  };

  const moveCursor = async (el) => {
    const r = el.getBoundingClientRect();
    cursor.classList.add('on');
    cursor.style.left = `${r.left + Math.min(r.width / 2, 40)}px`;
    cursor.style.top = `${r.top + Math.min(r.height / 2, 22)}px`;
    await wait(650);
  };
  const pressCursor = async (el) => {
    await moveCursor(el);
    cursor.classList.add('press');
    await wait(220);
    el.click();
    await wait(200);
    cursor.classList.remove('press');
  };

  const scrollTo = (el) => {
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).position === 'fixed') return;
    const top = r.height > innerHeight * 0.55 ? r.top - 80 : r.top - (innerHeight - r.height) / 3;
    if (r.top < 70 || r.bottom > innerHeight - 20 || r.height > innerHeight * 0.55) {
      scrollBy({ top, behavior: 'smooth' });
    }
  };

  const show = async (i) => {
    if (tour.busy || i < 0 || i >= STEPS.length) return;
    tour.busy = true;
    const prev = STEPS[tour.i];
    if (prev?.close) find(prev.close)?.click();
    tour.i = i;
    const step = STEPS[i];
    card.classList.add('fading');
    cursor.classList.remove('on');

    const route = typeof step.route === 'function' ? step.route() : step.route;
    if (route && location.hash !== route && !(route === '#/' && location.hash === '')) {
      location.hash = route;
      await wait(150);
    }
    let el = step.target ? await waitFor(step.target) : null;
    if (step.open) {
      const opener = find(step.open);
      if (opener && !el?.classList.contains('open')) {
        tour.target = opener;
        scrollTo(opener);
        await wait(300);
        await pressCursor(opener);
        cursor.classList.remove('on');
        el = await waitFor(step.target, 800) || el;
      }
    }
    if (el) { scrollTo(el); await wait(250); }
    tour.target = el;

    $('.tour-count').textContent = `${i + 1} / ${STEPS.length}`;
    $('#tourTitle').textContent = step.title;
    $('.tour-text').innerHTML = step.text;
    $('.tour-back').disabled = i === 0;
    $('.tour-next').textContent = i === 0 ? 'Start tour' : i === STEPS.length - 1 ? 'Finish' : step.click ? 'Click it →' : 'Next';
    $('.tour-skip').textContent = i === 0 ? 'Skip' : 'End tour';
    card.classList.remove('fading');
    if (step.click && el) moveCursor(el);   // hover over the button it is about to press
    tour.busy = false;
    $('.tour-next').focus({ preventScroll: true });
  };

  const next = async () => {
    if (tour.busy) return;
    const step = STEPS[tour.i];
    if (tour.i === STEPS.length - 1) return end();
    if (step.click && tour.target) {
      tour.busy = true;
      if (step.target.includes('mode=learn')) trainHash = tour.target.getAttribute('href') || trainHash;
      await pressCursor(tour.target);
      await wait(250);
      tour.busy = false;
    }
    show(tour.i + 1);
  };
  const back = () => { if (!tour.busy) show(tour.i - 1); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  };
  const end = () => {
    if (!tour) return;
    const cur = STEPS[tour.i];
    if (cur?.close) find(cur.close)?.click();
    cancelAnimationFrame(tour.raf);
    removeEventListener('keydown', onKey, true);
    layer.remove();
    tour = null;
    write(SEEN_KEY, '1');
  };

  $('.tour-next').addEventListener('click', next);
  $('.tour-back').addEventListener('click', back);
  $('.tour-skip').addEventListener('click', end);
  addEventListener('keydown', onKey, true);
  place();
  show(0);
}

export function initTutorial() {
  const btn = document.createElement('button');
  btn.className = 'tutorial-fab';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Start the guided tour');
  btn.title = 'Guided tour';
  btn.innerHTML = '<span aria-hidden="true">?</span><span class="tutorial-fab-label">Tutorial</span>';
  btn.addEventListener('click', startTour);
  document.body.insertBefore(btn, document.querySelector('.footer'));

  if (!read(SEEN_KEY)) setTimeout(startTour, 600);
}
