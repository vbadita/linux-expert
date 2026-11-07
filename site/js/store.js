// Progress in localStorage. Every access is guarded: storage can be blocked or full,
// and the course must still work (progress then lasts until the tab closes).
const KEY = 'linux-expert:v1';
let state = { done: {}, quiz: {}, labs: {}, exam: null };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = { ...state, ...JSON.parse(raw) };
} catch { /* blocked or corrupt: start empty */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* keep in memory */ }
}

export const lessonKey = (mod, lesson) => `${mod}/${lesson}`;
export const isDone = (mod, lesson) => !!state.done[lessonKey(mod, lesson)];
export const doneCount = (mod) => Object.keys(state.done).filter((k) => k.startsWith(mod + '/')).length;
export const totalDone = () => Object.keys(state.done).length;
export function markDone(mod, lesson) { state.done[lessonKey(mod, lesson)] = Date.now(); save(); }
export function unmarkDone(mod, lesson) { delete state.done[lessonKey(mod, lesson)]; save(); }

export const quizScore = (mod, lesson) => state.quiz[lessonKey(mod, lesson)] || null;
export function setQuizScore(mod, lesson, score, total) {
  const old = state.quiz[lessonKey(mod, lesson)];
  state.quiz[lessonKey(mod, lesson)] = { score, total, best: Math.max(score, old ? old.best : 0) };
  save();
}

export const labDone = (id) => !!state.labs[id];
export function setLabDone(id, steps) { state.labs[id] = { steps, at: Date.now() }; save(); }

export const examResult = () => state.exam;
export function setExam(score, total) {
  state.exam = { score, total, best: Math.max(score / total, state.exam ? state.exam.best : 0), at: Date.now() };
  save();
}

export function resetAll() {
  state = { done: {}, quiz: {}, labs: {}, exam: null };
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
