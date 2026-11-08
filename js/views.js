// All pages. Each view(ctx, ...args) returns a DOM node (or a promise of one).
import { el, md, mdEl, esc, copyBtn, levelBadge, LEVELS } from './util.js';
import * as store from './store.js';
import { getModule, getAll, moduleMeta, hasFile } from './data.js';
import { terminal, codeBlock } from './term.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const lessonHref = (m, l, page = 0) => `#/lesson/${m}/${l}` + (page ? '/' + page : '');
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const progressBar = (value, max, label) => {
  const span = el('span');
  span.style.width = pct(value, max) + '%';
  return el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-label': label }, span);
};
const sortedLessons = (mod) =>
  [...mod.lessons].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));

function modStatus(meta) {
  if (meta.status === 'soon') return { cls: 'soon', label: 'Coming soon' };
  const n = store.doneCount(meta.num);
  if (meta.kind === 'labs' || meta.kind === 'exam') return { cls: meta.status === 'partial' ? 'part' : '', label: meta.status === 'partial' ? 'In progress' : 'Open' };
  if (meta.lessons && n >= meta.lessons && meta.status === 'ready') return { cls: 'done', label: 'Done' };
  return { cls: n ? 'part' : '', label: n ? `${n}/${meta.lessons} done` : meta.status === 'partial' ? 'In progress' : 'Not started' };
}
const modHref = (meta) => (meta.kind === 'labs' ? '#/labs' : meta.kind === 'exam' ? '#/exam' : '#/module/' + meta.num);

// ---------- home and learning path ----------
export async function pathView({ idx }, { hero = false } = {}) {
  const root = el('div');
  const total = idx.modules.reduce((s, m) => s + (m.lessons || 0), 0);
  const done = store.totalDone();
  if (hero) {
    const next = await findNext(idx);
    root.append(el('section', { class: 'hero' },
      el('h1', {}, 'Linux Expert'),
      el('p', { class: 'lead' }, 'From first command to kernel internals. Every command was run on a real Linux system, and you see the recorded output. Each lesson explains how it works underneath.'),
      el('div', { class: 'stats' },
        el('div', {}, el('b', {}, `${done}/${total}`), 'lessons done'),
        el('div', {}, el('b', {}, String(idx.modules.filter((m) => m.status === 'ready' && !m.kind).length)), 'modules finished'),
        el('div', {}, el('b', {}, String(idx.modules.length)), 'modules planned')),
      progressBar(done, total, 'Course progress'),
      el('div', { class: 'btns' },
        next ? el('a', { class: 'btn primary', href: next.href }, next.label) : null,
        el('a', { class: 'btn', href: '#/labs' }, 'Troubleshooting labs'),
        el('a', { class: 'btn', href: '#/interview' }, 'Interview questions'))));
  } else root.append(el('h1', {}, 'Learning path'), el('p', { class: 'lead' }, 'All modules in order. Green = finished.'));
  for (const part of idx.parts) {
    const list = el('ul', { class: 'map' });
    for (const m of idx.modules.filter((x) => x.part === part.id)) {
      const st = modStatus(m);
      list.append(el('li', {}, el('a', { class: `node ${st.cls ? (st.cls === 'part' ? 'part-done' : st.cls) : ''}`, href: modHref(m) },
        el('span', { class: 'n' }, String(m.num)),
        el('span', {}, m.title, el('small', {}, st.label)))));
    }
    root.append(el('section', { class: 'part' }, el('h2', {}, `Part ${part.id}: ${part.title}`), list));
  }
  return root;
}

async function findNext(idx) {
  for (const m of idx.modules.filter((x) => hasFile(x) && !x.kind)) {
    const mod = await getModule(idx, m.num);
    const l = mod && sortedLessons(mod).find((x) => !store.isDone(m.num, x.id));
    if (l) return { href: lessonHref(m.num, l.id), label: store.totalDone() ? `Continue: ${l.title}` : `Start: ${l.title}` };
  }
  return null;
}

// ---------- module ----------
export async function moduleView({ idx }, num) {
  const meta = moduleMeta(idx, num);
  if (!meta) return notFound();
  const part = idx.parts.find((p) => p.id === meta.part);
  const st = modStatus(meta);
  const root = el('div', {},
    el('p', { class: 'crumbs' }, el('a', { href: '#/path' }, 'Path'), ` / Part ${part.id}: ${part.title}`),
    el('h1', {}, `${meta.num}. ${meta.title}`),
    el('span', { class: `badge st-${st.cls || 'soon'}` }, st.label),
    el('p', { class: 'lead' }, meta.summary));
  const mod = await getModule(idx, num);
  if (!mod) {
    root.append(el('p', {}, 'This module is not written yet. It will cover the topics above.'));
    return root;
  }
  if (mod.env) root.append(el('p', { class: 'note' }, 'Outputs recorded on: ' + mod.env));
  root.append(el('h2', {}, 'Lessons'));
  for (const l of sortedLessons(mod)) {
    const q = store.quizScore(meta.num, l.id);
    root.append(el('div', { class: 'card' },
      el('h3', {}, store.isDone(meta.num, l.id) ? '✓ ' : '', el('a', { href: lessonHref(meta.num, l.id) }, l.title), ' ', levelBadge(l.level)),
      el('p', {}, l.goal), q ? el('p', { class: 'tag' }, `Quiz: ${q.score}/${q.total} (best ${q.best})`) : null));
  }
  const iq = (mod.interview || []).length;
  if (iq) root.append(el('p', {}, el('a', { class: 'btn', href: `#/interview/${meta.num}/all` }, `Interview questions (${iq})`)));
  const labs = mod.labs || [];
  if (labs.length) root.append(el('p', {}, el('a', { class: 'btn', href: '#/labs' }, `Labs (${labs.length})`)));
  return root;
}

// ---------- lesson ----------
export async function lessonView({ idx }, num, lessonId, pageStr) {
  const meta = moduleMeta(idx, num);
  const mod = meta && (await getModule(idx, num));
  const lesson = mod && mod.lessons.find((l) => l.id === lessonId);
  if (!lesson) return notFound();
  const steps = lesson.steps;
  const pages = steps.length + 3; // intro, steps, quiz, check
  const page = Math.min(Math.max(parseInt(pageStr || '0', 10) || 0, 0), pages - 1);
  const go = (p) => { location.hash = lessonHref(num, lessonId, p); };
  const root = el('div', {});
  root.append(
    el('p', { class: 'crumbs' }, el('a', { href: '#/path' }, 'Path'), ' / ', el('a', { href: '#/module/' + num }, `${num}. ${mod.title}`)),
    el('div', { class: 'lesson-head' }, el('h1', {}, lesson.title), levelBadge(lesson.level),
      store.isDone(num, lessonId) ? el('span', { class: 'badge st-done' }, 'Done') : null),
    el('div', { class: 'stepper' }, progressBar(page, pages - 1, 'Lesson progress'),
      el('span', { class: 'stepcount' }, page === 0 ? 'Goal' : page <= steps.length ? `Step ${page} of ${steps.length}` : page === steps.length + 1 ? 'Quiz' : 'Check yourself')));

  if (page === 0) {
    root.append(el('div', { class: 'goal' }, el('b', {}, 'Goal'), mdEl(lesson.goal)));
    if (lesson.setup) root.append(trybox(lesson.setup));
    if (mod.env) root.append(el('p', { class: 'note' }, 'Outputs in this lesson were recorded on: ' + mod.env));
  } else if (page <= steps.length) {
    root.append(stepView(steps[page - 1]));
  } else if (page === steps.length + 1) {
    root.append(quizBlock(lesson.quiz || [], (score, total) => store.setQuizScore(num, lessonId, score, total)));
  } else {
    root.append(el('h2', {}, 'Check yourself'), checkBlock(lesson.check));
  }

  const last = page === pages - 1;
  const next = el('button', { type: 'button', class: 'primary', onclick: () => {
    if (!last) return go(page + 1);
    store.markDone(num, lessonId);
    const sorted = sortedLessons(mod);
    const nxt = sorted[sorted.findIndex((l) => l.id === lessonId) + 1];
    location.hash = nxt ? lessonHref(num, nxt.id) : '#/module/' + num;
  } }, last ? 'Finish lesson' : 'Next');
  root.append(el('div', { class: 'steps-nav' },
    el('button', { type: 'button', disabled: page === 0, onclick: () => go(page - 1) }, 'Back'), next));
  return root;
}

function trybox(setup) {
  return el('details', { class: 'trybox', open: true },
    el('summary', {}, 'Try it on your machine'),
    setup.note ? mdEl(setup.note) : null,
    codeBlock(setup.commands.join('\n'), 'sh', 'setup'));
}

function stepView(step) {
  const box = el('div', {}, el('h2', { class: 'step-title' }, step.title), mdEl(step.text));
  if (step.code) box.append(codeBlock(step.code.src, step.code.lang || 'c', step.code.file));
  for (const run of [].concat(step.run || [])) {
    box.append(terminal(run, { title: run.explanationOnly ? 'explanation only' : 'terminal' }));
    if (run.explanationOnly) box.append(el('span', { class: 'explain-only' }, 'Explanation only: ' + (run.reason || 'not run')));
  }
  if (step.under) box.append(el('div', { class: 'under' }, el('b', {}, 'Underneath'), mdEl(step.under)));
  if (step.after) box.append(mdEl(step.after));
  return box;
}

function quizBlock(questions, onComplete) {
  const root = el('div', {}, el('h2', {}, 'Quiz'));
  if (!questions.length) return el('div', {}, el('h2', {}, 'Quiz'), el('p', { class: 'note' }, 'No questions yet.'));
  const answered = new Array(questions.length).fill(null);
  const result = el('p', { class: 'score', 'aria-live': 'polite' });
  questions.forEach((q, qi) => {
    const why = el('div', { class: 'why', hidden: true });
    const opts = q.options.map((o, oi) => el('button', { type: 'button', class: 'opt', onclick: () => {
      if (answered[qi] !== null) return;
      answered[qi] = oi;
      opts.forEach((b, bi) => { b.disabled = true; if (bi === q.answer) b.classList.add('right'); else if (bi === oi) b.classList.add('wrong'); });
      why.hidden = false;
      why.replaceChildren(el('b', {}, oi === q.answer ? 'Correct. ' : 'Not quite. '), el('span', { html: md(q.explain).replace(/^<p>|<\/p>$/g, '') }));
      if (answered.every((a) => a !== null)) {
        const score = answered.filter((a, i) => a === questions[i].answer).length;
        result.textContent = `Score: ${score}/${questions.length}`;
        onComplete(score, questions.length);
      }
    } }, o));
    root.append(el('div', { class: 'q' }, el('p', { class: 'q-text' }, `${qi + 1}. ${q.q}`), el('div', { class: 'opts' }, opts), why));
  });
  root.append(result);
  return root;
}

function checkBlock(check) {
  if (!check) return el('p', { class: 'note' }, 'No scenario yet.');
  const ans = el('div', { class: 'answer', hidden: true }, mdEl(check.answer));
  const btn = el('button', { type: 'button', onclick: () => {
    ans.hidden = !ans.hidden;
    btn.textContent = ans.hidden ? 'Show answer' : 'Hide answer';
  } }, 'Show answer');
  return el('div', { class: 'check' }, mdEl(check.scenario), btn, ans);
}

// ---------- interview ----------
export async function interviewView({ idx }, modSel = 'all', lvSel = 'all') {
  const all = await getAll(idx);
  const items = all.flatMap((m) => (m.interview || []).map((x) => ({ ...x, m })));
  const root = el('div', {}, el('h1', {}, 'Interview questions'),
    el('p', { class: 'lead' }, 'Questions and answers from every module. Try to answer before you open it.'));
  const modSelect = el('select', { 'aria-label': 'Module' }, el('option', { value: 'all' }, 'All modules'),
    ...all.filter((m) => (m.interview || []).length).map((m) => el('option', { value: m.meta.num, selected: String(m.meta.num) === String(modSel) }, `${m.meta.num}. ${m.title}`)));
  const lvSelect = el('select', { 'aria-label': 'Level' }, el('option', { value: 'all' }, 'All levels'),
    ...LEVELS.map((l) => el('option', { value: l, selected: l === lvSel }, cap(l))));
  const upd = () => { location.hash = `#/interview/${modSelect.value}/${lvSelect.value}`; };
  modSelect.addEventListener('change', upd); lvSelect.addEventListener('change', upd);
  root.append(el('div', { class: 'filters' }, modSelect, lvSelect));
  const shown = items.filter((x) => (modSel === 'all' || String(x.m.meta.num) === String(modSel)) && (lvSel === 'all' || x.level === lvSel));
  root.append(el('p', { class: 'tag' }, `${shown.length} of ${items.length} questions`));
  for (const x of shown) {
    root.append(el('details', { class: 'qa' },
      el('summary', {}, x.q), el('p', {}, levelBadge(x.level), ' ', el('a', { class: 'tag', href: '#/module/' + x.m.meta.num }, `Module ${x.m.meta.num}: ${x.m.title}`)),
      mdEl(x.a)));
  }
  if (!shown.length) root.append(el('p', { class: 'note' }, 'No questions match yet.'));
  return root;
}

// ---------- cheat sheet ----------
export async function cheatView({ idx }) {
  const all = await getAll(idx);
  const cmds = all.flatMap((m) => (m.commands || []).map((c) => ({ ...c, m })));
  const root = el('div', {}, el('h1', {}, 'Cheat sheet'), el('p', { class: 'lead' }, `${cmds.length} commands from the course, grouped by topic.`));
  const filter = el('input', { type: 'search', placeholder: 'Filter commands', 'aria-label': 'Filter commands' });
  const out = el('div');
  const draw = () => {
    const f = filter.value.toLowerCase();
    out.replaceChildren();
    const topics = new Map();
    for (const c of cmds) {
      if (f && !(c.cmd + ' ' + c.desc + ' ' + c.topic).toLowerCase().includes(f)) continue;
      if (!topics.has(c.topic)) topics.set(c.topic, []);
      topics.get(c.topic).push(c);
    }
    for (const [topic, list] of [...topics].sort((a, b) => a[0].localeCompare(b[0]))) {
      out.append(el('h2', {}, topic));
      for (const c of list) {
        out.append(el('div', { class: 'cmdrow' }, el('pre', {}, c.cmd), el('div', { class: 'd' }, c.desc, c.lesson ? [' ', el('a', { href: '#/lesson/' + c.lesson }, 'lesson')] : null), copyBtn(c.cmd, 'Copy command')));
      }
    }
    if (!topics.size) out.append(el('p', { class: 'note' }, 'Nothing matches.'));
  };
  filter.addEventListener('input', draw);
  root.append(el('div', { class: 'filters' }, filter)); draw(); root.append(out);
  return root;
}

// ---------- glossary ----------
export async function glossaryView({ idx }) {
  const all = await getAll(idx);
  const terms = all.flatMap((m) => m.glossary || []).sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
  const root = el('div', {}, el('h1', {}, 'Glossary'), el('p', { class: 'lead' }, `${terms.length} terms. Each links to the lesson that explains it.`));
  const filter = el('input', { type: 'search', placeholder: 'Filter terms', 'aria-label': 'Filter terms' });
  const dl = el('dl', { class: 'gl' });
  const draw = () => {
    const f = filter.value.toLowerCase();
    dl.replaceChildren();
    for (const t of terms) {
      if (f && !(t.term + ' ' + t.def).toLowerCase().includes(f)) continue;
      dl.append(el('dt', { id: 'g-' + t.term.toLowerCase().replace(/\W+/g, '-') }, t.term),
        el('dd', {}, t.def, t.lesson ? [' ', el('a', { href: '#/lesson/' + t.lesson }, 'Read the lesson')] : null));
    }
  };
  filter.addEventListener('input', draw);
  root.append(el('div', { class: 'filters' }, filter)); draw(); root.append(dl);
  return root;
}

// ---------- labs ----------
export async function labsView({ idx }) {
  const all = await getAll(idx);
  const labs = all.flatMap((m) => (m.labs || []).map((l) => ({ ...l, m })));
  const root = el('div', {}, el('h1', {}, 'Troubleshooting labs'),
    el('p', { class: 'lead' }, 'Realistic incidents. At each step you pick the next command and see its real output.'));
  for (const l of labs) {
    root.append(el('div', { class: 'card' },
      el('h3', {}, store.labDone(l.id) ? '✓ ' : '', el('a', { href: '#/lab/' + l.id }, l.title), ' ', levelBadge(l.level)),
      mdEl(l.symptom)));
  }
  if (!labs.length) root.append(el('p', { class: 'note' }, 'No labs yet.'));
  return root;
}

export async function labView({ idx }, id) {
  const all = await getAll(idx);
  let lab = null;
  for (const m of all) lab = lab || (m.labs || []).find((l) => l.id === id);
  if (!lab) return notFound();
  const root = el('div', {}, el('p', { class: 'crumbs' }, el('a', { href: '#/labs' }, 'Labs')),
    el('div', { class: 'lesson-head' }, el('h1', {}, lab.title), levelBadge(lab.level)),
    el('div', { class: 'goal' }, el('b', {}, 'Incident'), mdEl(lab.symptom)),
    lab.build ? el('details', { class: 'trybox' }, el('summary', {}, 'How this lab was built (recorded on a real system)'),
      el('p', { class: 'note' }, 'These commands created the situation before the outputs were recorded. They need root and a free mount point, so only run them on a throwaway machine.'),
      codeBlock(lab.build.join('\n'), 'sh', 'build')) : null);
  const log = el('div'); const choices = el('div'); let taken = 0;
  root.append(log, choices);
  const show = (si) => {
    const step = lab.steps[si];
    choices.replaceChildren(mdEl(step.prompt), el('div', { class: 'choices' }, step.choices.map((c) =>
      el('button', { type: 'button', onclick: () => pick(si, c) }, '$ ' + c.cmd))));
  };
  const pick = (si, c) => {
    taken++;
    choices.replaceChildren(el('p', { class: 'note' }, 'Running…'));
    log.append(terminal({ cmd: c.cmd, output: c.output, explanationOnly: c.explanationOnly, reason: c.reason }, {
      title: `step ${si + 1}`, autorun: true,
      onDone: () => {
        log.append(el('div', { class: `verdict ${c.verdict || ''}` }, mdEl(c.note)));
        if (c.next === 'done') {
          store.setLabDone(lab.id, taken);
          choices.replaceChildren(el('div', { class: 'card' }, el('h3', {}, 'Resolved'), mdEl(lab.conclusion),
            el('p', { class: 'tag' }, `You used ${taken} commands.`)),
          el('p', {}, el('button', { type: 'button', onclick: () => { location.reload(); } }, 'Play again'), ' ', el('a', { class: 'btn', href: '#/labs' }, 'All labs')));
        } else show(typeof c.next === 'number' ? c.next : si);
      },
    }));
  };
  show(0);
  return root;
}

// ---------- final exam ----------
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export async function examView({ idx }) {
  const all = await getAll(idx);
  const pool = all.flatMap((m) => [...(m.lessons || []).flatMap((l) => l.quiz || []), ...(m.exam || [])].map((q) => ({ ...q, mod: m.title })));
  const prev = store.examResult();
  const root = el('div', {}, el('h1', {}, 'Final exam'),
    el('p', { class: 'lead' }, `Mixed questions from all modules (${pool.length} in the pool). Up to 20 are drawn at random. Explanations appear after you submit.`),
    prev ? el('p', {}, `Last: ${prev.score}/${prev.total}. Best: ${Math.round(100 * prev.best)}%.`) : null);
  const area = el('div');
  const start = () => {
    const qs = shuffle([...pool]).slice(0, 20);
    const chosen = new Array(qs.length).fill(null);
    area.replaceChildren();
    const submit = el('button', { type: 'button', class: 'primary', disabled: true }, 'Submit');
    const res = el('p', { class: 'score', 'aria-live': 'polite' });
    const all_opts = qs.map((q, qi) => {
      const why = el('div', { class: 'why', hidden: true });
      const opts = q.options.map((o, oi) => el('button', { type: 'button', class: 'opt', 'aria-pressed': 'false', onclick: () => {
        chosen[qi] = oi;
        opts.forEach((b, bi) => { b.setAttribute('aria-pressed', String(bi === oi)); b.style.fontWeight = bi === oi ? '700' : ''; });
        submit.disabled = !chosen.every((c) => c !== null);
      } }, o));
      area.append(el('div', { class: 'q' }, el('p', { class: 'q-text' }, `${qi + 1}. ${q.q}`), el('p', { class: 'tag' }, q.mod), el('div', { class: 'opts' }, opts), why));
      return { opts, why, q };
    });
    submit.addEventListener('click', () => {
      let score = 0;
      all_opts.forEach(({ opts, why, q }, qi) => {
        opts.forEach((b, bi) => { b.disabled = true; if (bi === q.answer) b.classList.add('right'); else if (bi === chosen[qi]) b.classList.add('wrong'); });
        if (chosen[qi] === q.answer) score++;
        why.hidden = false; why.replaceChildren(el('span', { html: md(q.explain).replace(/^<p>|<\/p>$/g, '') }));
      });
      store.setExam(score, qs.length);
      res.textContent = `Score: ${score}/${qs.length} (${pct(score, qs.length)}%)`;
      submit.replaceWith(el('button', { type: 'button', onclick: () => { start(); window.scrollTo(0, 0); } }, 'Try another set'));
      res.scrollIntoView({ block: 'center' });
    });
    area.append(submit, res);
  };
  if (pool.length < 4) root.append(el('p', { class: 'note' }, 'Not enough questions yet. The exam opens when more modules are written.'));
  else root.append(el('button', { type: 'button', class: 'primary', onclick: start }, prev ? 'Start a new exam' : 'Start exam'));
  root.append(area);
  return root;
}

// ---------- search ----------
let docs = null;
async function buildDocs(idx) {
  if (docs) return docs;
  const all = await getAll(idx);
  docs = [];
  for (const m of all) {
    for (const l of m.lessons || []) {
      docs.push({ kind: 'Lesson', title: l.title, text: l.goal, href: lessonHref(m.meta.num, l.id), where: `Module ${m.meta.num}` });
      l.steps.forEach((s, i) => {
        const runs = [].concat(s.run || []);
        docs.push({ kind: 'Lesson step', title: `${l.title}: ${s.title}`, href: lessonHref(m.meta.num, l.id, i + 1), where: `Module ${m.meta.num}`,
          text: [s.text, s.under, s.after, s.code && s.code.src, ...runs.map((r) => r.cmd + '\n' + (r.output || ''))].filter(Boolean).join('\n') });
      });
    }
    for (const c of m.commands || []) docs.push({ kind: 'Command', title: c.cmd, text: c.desc + ' ' + c.topic, href: '#/cheat', where: 'Cheat sheet' });
    for (const g of m.glossary || []) docs.push({ kind: 'Glossary', title: g.term, text: g.def, href: g.lesson ? '#/lesson/' + g.lesson : '#/glossary', where: 'Glossary' });
    for (const q of m.interview || []) docs.push({ kind: 'Interview', title: q.q, text: q.a, href: `#/interview/${m.meta.num}/all`, where: `Module ${m.meta.num}` });
    for (const lab of m.labs || []) docs.push({ kind: 'Lab', title: lab.title, text: lab.symptom, href: '#/lab/' + lab.id, where: 'Labs' });
  }
  for (const d of docs) { d.lt = d.title.toLowerCase(); d.lx = d.text.toLowerCase(); }
  return docs;
}

export async function searchView({ idx }, q) {
  const root = el('div', {}, el('h1', {}, 'Search'));
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return el('div', {}, root, el('p', { class: 'note' }, 'Type something in the search box.'));
  const list = await buildDocs(idx);
  const hits = [];
  for (const d of list) {
    if (!terms.every((t) => d.lt.includes(t) || d.lx.includes(t))) continue;
    let score = 0;
    for (const t of terms) score += (d.lt.includes(t) ? 10 : 0) + Math.min(5, d.lx.split(t).length - 1);
    hits.push({ d, score });
  }
  hits.sort((a, b) => b.score - a.score);
  root.append(el('p', { class: 'tag' }, `${hits.length} result${hits.length === 1 ? '' : 's'} for “${q}”` + (hits.length > 50 ? ' (showing 50)' : '')));
  const alt = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp('(' + alt + ')', 'gi');
  const first = new RegExp(alt);
  const mark = (s) => esc(s).replace(re, '<mark>$1</mark>');
  for (const { d } of hits.slice(0, 50)) {
    const at = Math.max(0, d.lx.search(first));
    const snip = d.text.slice(Math.max(0, at - 50), at + 140).replace(/\s+/g, ' ');
    root.append(el('div', { class: 'hit' }, el('span', { class: 'kind' }, `${d.kind} · ${d.where}`),
      el('div', {}, el('a', { href: d.href, html: mark(d.title) })), el('p', { html: (at > 50 ? '…' : '') + mark(snip) + '…' })));
  }
  return root;
}

export function notFound() {
  return el('div', {}, el('h1', {}, 'Not found'), el('p', {}, 'That page does not exist. ', el('a', { href: '#/path' }, 'Back to the path.')));
}
