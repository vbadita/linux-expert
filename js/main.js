// Router and page chrome. Hash routes keep every path relative, so the site works
// under /linux/ (or any base path) with no server rewrites.
import { $ } from './util.js';
import { getIndex } from './data.js';
import * as store from './store.js';
import * as v from './views.js';

const app = $('#app');
let idx = null;

const routes = [
  [/^$/, () => v.pathView({ idx }, { hero: true })],
  [/^path$/, () => v.pathView({ idx })],
  [/^module\/(\d+)$/, (n) => v.moduleView({ idx }, n)],
  [/^lesson\/(\d+)\/([\w-]+)(?:\/(\d+))?$/, (n, l, p) => v.lessonView({ idx }, n, l, p)],
  [/^interview(?:\/(\w+)\/(\w+))?$/, (m, l) => v.interviewView({ idx }, m, l)],
  [/^cheat$/, () => v.cheatView({ idx })],
  [/^glossary$/, () => v.glossaryView({ idx })],
  [/^labs$/, () => v.labsView({ idx })],
  [/^lab\/([\w-]+)$/, (id) => v.labView({ idx }, id)],
  [/^exam$/, () => v.examView({ idx })],
  [/^search\/(.*)$/, (q) => v.searchView({ idx }, decodeURIComponent(q))],
];

async function render() {
  const path = location.hash.replace(/^#\/?/, '');
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', path.split('/')[0] === a.dataset.r);
  let node = null;
  try {
    if (!idx) idx = await getIndex();
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (m) { node = await fn(...m.slice(1)); break; }
    }
    node = node || v.notFound();
  } catch (e) {
    node = document.createElement('p');
    node.textContent = 'Could not load this page: ' + e.message;
  }
  app.replaceChildren(node);
  if (!path.startsWith('search/')) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
  const total = idx ? idx.modules.reduce((s, m) => s + (m.lessons || 0), 0) : 0;
  $('#foot-progress').textContent = `${store.totalDone()}/${total} lessons done`;
}

addEventListener('hashchange', render);

let timer;
$('#q').addEventListener('input', (e) => {
  clearTimeout(timer);
  const q = e.target.value.trim();
  timer = setTimeout(() => {
    const target = q ? '#/search/' + encodeURIComponent(q) : '#/';
    if (location.hash.startsWith('#/search/') && q) { history.replaceState(null, '', target); render(); } else location.hash = target;
  }, 250);
});
$('#searchform').addEventListener('submit', (e) => e.preventDefault());

$('#reset').addEventListener('click', () => {
  if (confirm('Reset all progress (completed lessons, quiz scores, labs, exam)? This cannot be undone.')) {
    store.resetAll();
    render();
  }
});

render();
