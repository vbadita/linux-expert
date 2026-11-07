// Small DOM + text helpers. Everything user-visible goes through esc() or textContent.
export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inline markup: `code`, **bold**, [text](#/route or https://...). Input is escaped first.
export function inline(s) {
  return String(s).split(/(`[^`]+`)/).map((part, i) => {
    if (i % 2) return '<code>' + esc(part.slice(1, -1)) + '</code>';
    return esc(part)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((#\/[^)\s]*|https:\/\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  }).join('');
}

// Block markup: paragraphs, "- " lists, "1. " lists, "> " quotes. Blank line separates blocks.
export function md(s) {
  return String(s ?? '').trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^- /.test(l))) return '<ul>' + lines.map((l) => '<li>' + inline(l.slice(2)) + '</li>').join('') + '</ul>';
    if (lines.every((l) => /^\d+\. /.test(l))) return '<ol>' + lines.map((l) => '<li>' + inline(l.replace(/^\d+\. /, '')) + '</li>').join('') + '</ol>';
    if (lines.every((l) => /^> ?/.test(l))) return '<blockquote>' + inline(lines.map((l) => l.replace(/^> ?/, '')).join(' ')) + '</blockquote>';
    return '<p>' + inline(lines.join(' ')) + '</p>';
  }).join('');
}

export function mdEl(s, cls) {
  return el('div', { class: cls, html: md(s) });
}

export async function copyText(text, btn) {
  const done = () => { const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = old; }, 1200); };
  try { await navigator.clipboard.writeText(text); done(); return; } catch { /* fall through */ }
  const ta = el('textarea', { class: 'sr', 'aria-hidden': 'true' });
  ta.value = text; document.body.append(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch { btn.textContent = 'Copy failed'; }
  ta.remove();
}

export const copyBtn = (text, label = 'Copy') =>
  el('button', { type: 'button', 'aria-label': label + ' to clipboard', onclick: (e) => copyText(text, e.currentTarget) }, 'Copy');

export const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
export const levelBadge = (lv) => el('span', { class: 'badge lv-' + lv }, lv[0].toUpperCase() + lv.slice(1));
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
