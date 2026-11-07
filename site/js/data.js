// Loads content/index.json and the per-module files (content/NN-slug.json). Cached.
let index = null;
const mods = new Map();

export async function getIndex() {
  if (!index) {
    const r = await fetch('content/index.json');
    if (!r.ok) throw new Error('content/index.json: HTTP ' + r.status);
    index = await r.json();
  }
  return index;
}

export const moduleMeta = (idx, num) => idx.modules.find((m) => m.num === Number(num));
export const hasFile = (m) => !!m.file && m.status !== 'soon';

export async function getModule(idx, num) {
  const meta = moduleMeta(idx, num);
  if (!meta || !hasFile(meta)) return null;
  if (!mods.has(meta.num)) {
    const p = fetch('content/' + meta.file).then((r) => {
      if (!r.ok) throw new Error(meta.file + ': HTTP ' + r.status);
      return r.json();
    }).then((d) => ({ ...d, meta }));
    mods.set(meta.num, p);
  }
  return mods.get(meta.num);
}

// Every module that has a data file, in curriculum order.
export async function getAll(idx) {
  const list = await Promise.all(idx.modules.filter(hasFile).map((m) => getModule(idx, m.num)));
  return list.filter(Boolean);
}
