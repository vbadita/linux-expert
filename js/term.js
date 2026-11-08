// Simulated terminal: types the command, then shows the RECORDED output.
// Nothing is executed in the browser.
import { el, esc, copyBtn, reduceMotion } from './util.js';
import { highlight } from './highlight.js';

const PROMPT = '<span class="prompt">$ </span>';

// run = { cmd, output, explanationOnly?, reason? }
export function terminal(run, { title = 'terminal', autorun = false, onDone = null } = {}) {
  const body = el('pre', { class: 'term-body', 'aria-live': 'polite' });
  const runBtn = el('button', { type: 'button', class: 'run' }, 'Run');
  const wrap = el('div', { class: 'term' },
    el('div', { class: 'term-bar' }, el('span', {}, title),
      el('span', {}, copyBtn(run.cmd, 'Copy command'), ' ', runBtn)),
    body);
  let timer = null, fired = false;
  const showIdle = () => { body.innerHTML = PROMPT + highlight(run.cmd) + '<span class="caret"></span>'; };
  showIdle();

  function finish() {
    body.innerHTML = PROMPT + highlight(run.cmd) + '\n';
    if (run.explanationOnly) {
      body.append(el('span', { class: 'term-dim' }, `(explanation only: ${run.reason || 'not run'})`));
    } else if (run.output) {
      body.append(el('span', { class: 'term-out' }, run.output + '\n'));
    }
    runBtn.textContent = 'Run again'; runBtn.disabled = false;
    if (onDone && !fired) { fired = true; onDone(); }
  }
  function start() {
    clearInterval(timer);
    runBtn.disabled = true;
    if (reduceMotion()) return finish();
    const text = run.cmd; let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 60));
    body.innerHTML = PROMPT + '<span class="caret"></span>';
    timer = setInterval(() => {
      i = Math.min(text.length, i + step);
      body.innerHTML = PROMPT + esc(text.slice(0, i)) + '<span class="caret"></span>';
      if (i >= text.length) { clearInterval(timer); setTimeout(finish, 200); }
    }, 22);
  }
  runBtn.addEventListener('click', start);
  if (autorun) start();
  wrap.stop = () => clearInterval(timer);
  return wrap;
}

// Static, copyable source listing with syntax highlighting.
export function codeBlock(src, lang = 'sh', file = '') {
  return el('div', { class: 'code' },
    el('div', { class: 'code-bar' }, el('span', {}, file || lang), copyBtn(src, 'Copy code')),
    el('pre', { html: highlight(src.replace(/\n$/, ''), lang) }));
}
