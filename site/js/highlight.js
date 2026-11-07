// Tiny syntax highlighter (no CDN, so the site works under a strict CSP).
// Languages: sh (default), c, py. Returns safe HTML.
import { esc } from './util.js';

const RULES = {
  sh: [
    ['com', /#.*/],
    ['str', /"(?:\\.|[^"\\])*"|'[^']*'/],
    ['var', /\$(?:\{[^}]*\}|\(|[A-Za-z_][A-Za-z0-9_]*|[0-9?$!#@*-])/],
    ['kw', /\b(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|return|local|export|set|trap)\b/],
    ['fn', /(?:^|(?<=[|;&(]\s*))(?:sudo\s+)?[A-Za-z_./][\w./-]*/],
    ['num', /\b\d+\b/],
  ],
  c: [
    ['com', /\/\/.*|\/\*[\s\S]*?\*\//],
    ['str', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/],
    ['kw', /\b(?:int|char|void|long|unsigned|short|const|static|struct|return|if|else|for|while|do|break|continue|sizeof|size_t|ssize_t|pid_t|NULL|switch|case|typedef)\b/],
    ['kw', /#\s*\w+/],
    ['num', /\b(?:0x[0-9a-fA-F]+|\d+)\b/],
    ['fn', /\b[A-Za-z_]\w*(?=\()/],
  ],
  py: [
    ['com', /#.*/],
    ['str', /"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/],
    ['kw', /\b(?:def|class|import|from|as|return|if|elif|else|for|while|in|not|and|or|with|try|except|finally|raise|lambda|None|True|False|pass)\b/],
    ['num', /\b\d+\b/],
    ['fn', /\b[A-Za-z_]\w*(?=\()/],
  ],
};

export function highlight(code, lang = 'sh') {
  const rules = RULES[lang];
  if (!rules) return esc(code);
  const re = new RegExp(rules.map((r) => '(' + r[1].source + ')').join('|'), 'gm');
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    const idx = m.findIndex((g, i) => i > 0 && g !== undefined) - 1;
    out += esc(code.slice(last, m.index)) + `<span class="tok-${rules[idx][0]}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}
