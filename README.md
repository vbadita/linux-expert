# Linux Expert

Interactive Linux course, served at `https://apps.badita.com/linux/`. Static HTML, CSS and
vanilla JavaScript. No backend, no build step. All outputs in the lessons are recorded from a real system.

## Layout
```
site/index.html, style.css      page shell and styles (same palette as legi-adoptate)
site/js/                        main.js (router) views.js store.js term.js highlight.js data.js util.js
site/content/index.json         parts and the list of 49 modules (title, summary, status, file)
site/content/NN-slug.json       one file per module: lessons, interview, glossary, commands, labs
scripts/capture.py              runs every command for real, writes the output into the JSON
scripts/validate.py             checks the data (run before committing; CI runs it too)
tests/serve.py, e2e.mjs         local server with production headers; browser tests
deploy/, .github/workflows/     deployment (see below)
```
Routes are hash based (`#/lesson/1/how-bash-runs-a-command/3`), so every path is relative and the site works under any base path.

## Add or edit a lesson
1. Write the lesson in the module file with `cmd` only (no `output`). See the format below.
2. `scripts/capture.py site/content/01-shell.json` runs each lesson in a fresh `/tmp/lab` in one bash session and records stdout+stderr.
3. `scripts/validate.py --fix` checks the data and updates the lesson counts in `index.json`.
4. In `index.json` set the module `status`: `soon` (no page content), `partial`, or `ready`.

Rules for commands: they must not read stdin (input comes from a pipe), and must be safe to run. Use `"explanationOnly": true` plus a `reason` for anything that cannot run (D-state hang, disk failure, reboot); no output is recorded for those.
Outputs show the recording machine's user name, PIDs and paths; the module `env` field (filled by capture) says which system.

## Lesson JSON
```json
{
  "id": "how-bash-runs-a-command",          // [A-Za-z0-9_-], unique in the module
  "title": "...", "level": "beginner",      // beginner | intermediate | advanced | expert
  "goal": "What we learn and why it matters.",
  "setup": { "note": "...", "commands": ["mkdir -p /tmp/lab && cd /tmp/lab"] },   // "Try it on your machine"
  "steps": [{
    "title": "One idea",
    "text": "Short sentences. `code`, **bold**, [link](#/glossary). Blank line = new paragraph; '- ' lists.",
    "code": { "file": "demo.c", "lang": "c", "src": "full source" },   // optional; saved to /tmp/lab/demo.c when capturing
    "run": [{ "cmd": "ls" }],                                          // object or array; "output" is filled by capture.py
    "under": "How it works underneath (kernel, syscalls).",            // optional
    "after": "Text after the terminal."                                // optional
  }],
  "quiz": [{ "q": "...", "options": ["a","b","c"], "answer": 1, "explain": "..." }],
  "check": { "scenario": "...", "answer": "..." }
}
```
Module file top level: `title`, `lessons[]`, `interview[]` (`{q, a, level}`), `glossary[]` (`{term, def, lesson:"1/lesson-id"}`),
`commands[]` (`{cmd, desc, topic, lesson?}`, the cheat sheet), `exam[]` (extra exam questions, same shape as quiz), `labs[]`.
Order lessons basics, intermediate, advanced; module interview questions come last (rule 7).

## Recording rules (what `capture.py` guarantees)
- Every lesson runs in **one** interactive `bash` session in `/tmp/lab`, so variables, `cd` and background jobs carry from step to step like at a terminal. Commands must not read stdin.
- A step's `code` file is written into the session's current directory before its runs.
- The recorder refuses to store output that contains this machine's hostname, IP addresses, MAC addresses or machine-id (the site is public). Use namespaces, loopback or documentation addresses (10.200.x.x, 192.0.2.x). A version string that looks like an IP can be allowed with `"ok": "ip"` on the run.
- Two captures never run at once (a lock file), because they share `/tmp/lab`. Never use a bare `wait` in a recorded command when earlier steps started background jobs: wait for a specific PID (`wait $T`).
- Never use `pkill -f` on a pattern that also appears in the command line that runs it.

## Lab JSON
`{id, title, level, symptom, build[], teardown[], steps[{prompt, choices[{cmd, verdict: good|ok|poor, note, next}]}], conclusion}`.
`next` is a step index, or `"done"` to finish; no `next` keeps the learner on the same step. `build` (may use sudo) prepares the
situation during capture and is shown to the learner. Put destructive choices last-resort as `explanationOnly`.

## Final exam
Module 49 draws up to 20 random questions from **every lesson quiz** plus the `exam` array of any module file (module 49's own file holds extra mixed questions). Nothing to configure.

## Test locally
```
python3 tests/serve.py 8123            # http://127.0.0.1:8123/linux/ with the production CSP
scripts/validate.py
npm i playwright-core && node tests/e2e.mjs http://127.0.0.1:8123/linux/ /tmp/shots   # needs chromium
```
The test covers every lesson step, terminal, copy buttons, quiz, search, labs, exam, reset, light and dark mode, phone width.

## Deploy to apps.badita.com/linux
Same pull-based pattern as bash-sim (no inbound access, no secrets):
1. Create the GitHub repo `vbadita/linux-expert` (public: the VM pulls without credentials) and push `main`.
2. CI (`.github/workflows/site.yml`) validates, runs the browser tests, builds, force-pushes branch `site`, waits until the VM serves that commit, and checks the live page.
3. On the VM, once: `sudo -v && deploy/install-sync.sh`. It creates user `linux-web`, `/srv/linux-expert`, the SELinux label, the `linux-site-sync.timer` (every 5 min), and `/etc/nginx/apps.badita.com.d/linux.conf`, then reloads nginx.
4. Add a "Linux Expert" card to the directory page (anm-shortage-history repo, `deploy/portal/`) and run its `install.sh`; add the sitemap line to robots if wanted.
Rollback: point the symlink `/srv/linux-expert/linux` at an older `releases/<sha>`.
