#!/usr/bin/env python3
"""Check the course data files. Exit 1 on any problem.

usage: scripts/validate.py [--fix]
--fix  rewrites the `lessons` count of each module in content/index.json.
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "content")
LEVELS = ["beginner", "intermediate", "advanced", "expert"]
errors = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def check_runs(where, runs):
    for r in runs:
        if not isinstance(r, dict) or "cmd" not in r:
            err(where, "run needs `cmd`")
        elif r.get("explanationOnly"):
            if not r.get("reason"):
                err(where, f"explanationOnly run needs a `reason`: {r['cmd'][:40]}")
        elif "output" not in r:
            err(where, f"no recorded output (run scripts/capture.py): {r['cmd'][:50]}")


def check_quiz(where, quiz, need=True):
    if need and not quiz:
        err(where, "quiz is empty")
    for i, q in enumerate(quiz):
        w = f"{where} quiz[{i}]"
        for k in ("q", "options", "answer", "explain"):
            if k not in q:
                err(w, f"missing `{k}`")
        if "options" in q and not (2 <= len(q["options"]) <= 6):
            err(w, "needs 2-6 options")
        if "answer" in q and "options" in q and not (isinstance(q["answer"], int) and 0 <= q["answer"] < len(q["options"])):
            err(w, "`answer` is not an option index")


def main():
    idx = json.load(open(os.path.join(ROOT, "index.json")))
    nums = [m["num"] for m in idx["modules"]]
    if nums != list(range(1, len(nums) + 1)):
        err("index.json", "module numbers must be 1..N in order")
    part_ids = {p["id"] for p in idx["parts"]}
    lesson_ids = set()
    loaded = {}
    for m in idx["modules"]:
        w = f"index.json module {m['num']}"
        if m["part"] not in part_ids:
            err(w, "unknown part")
        if m["status"] not in ("ready", "partial", "soon"):
            err(w, "status must be ready, partial or soon")
        if m.get("file") and m["status"] != "soon":
            p = os.path.join(ROOT, m["file"])
            if not os.path.exists(p):
                err(w, f"missing file {m['file']}")
                continue
            loaded[m["num"]] = json.load(open(p))
    seen_labs = set()
    for num, d in loaded.items():
        n = len(d.get("lessons", []))
        meta = next(m for m in idx["modules"] if m["num"] == num)
        if meta["lessons"] != n:
            if "--fix" in sys.argv:
                meta["lessons"] = n
            else:
                err(f"module {num}", f"index.json says {meta['lessons']} lessons, file has {n} (use --fix)")
        for l in d.get("lessons", []):
            w = f"module {num} lesson {l.get('id')}"
            if not re.fullmatch(r"[\w-]+", l.get("id", "")):
                err(w, "bad id")
            lesson_ids.add(f"{num}/{l.get('id')}")
            if l.get("level") not in LEVELS:
                err(w, "level must be one of " + "/".join(LEVELS))
            for k in ("title", "goal", "steps", "quiz", "check"):
                if not l.get(k):
                    err(w, f"missing `{k}`")
            if l.get("check") and not (l["check"].get("scenario") and l["check"].get("answer")):
                err(w, "check needs scenario and answer")
            for si, s in enumerate(l.get("steps", [])):
                sw = f"{w} step {si + 1}"
                if not s.get("title") or not s.get("text"):
                    err(sw, "needs title and text")
                if s.get("code") and not (s["code"].get("src") and s["code"].get("file")):
                    err(sw, "code needs file and src")
                check_runs(sw, [s["run"]] if isinstance(s.get("run"), dict) else s.get("run") or [])
            check_quiz(w, l.get("quiz", []))
        for i, q in enumerate(d.get("interview", [])):
            if not (q.get("q") and q.get("a") and q.get("level") in LEVELS):
                err(f"module {num} interview[{i}]", "needs q, a and a valid level")
        for i, c in enumerate(d.get("commands", [])):
            if not (c.get("cmd") and c.get("desc") and c.get("topic")):
                err(f"module {num} commands[{i}]", "needs cmd, desc, topic")
        check_quiz(f"module {num} exam", d.get("exam", []), need=False)
        for lab in d.get("labs", []):
            w = f"lab {lab.get('id')}"
            if lab["id"] in seen_labs:
                err(w, "duplicate id")
            seen_labs.add(lab["id"])
            for k in ("title", "level", "symptom", "steps", "conclusion"):
                if not lab.get(k):
                    err(w, f"missing `{k}`")
            reaches_done = False
            for si, st in enumerate(lab.get("steps", [])):
                for ci, ch in enumerate(st.get("choices", [])):
                    check_runs(f"{w} step {si + 1} choice {ci + 1}", [ch])
                    if not ch.get("note"):
                        err(w, f"step {si + 1} choice {ci + 1}: needs a note")
                    nx = ch.get("next")
                    if nx == "done":
                        reaches_done = True
                    elif isinstance(nx, int) and not 0 <= nx < len(lab["steps"]):
                        err(w, f"step {si + 1} choice {ci + 1}: next out of range")
            if not reaches_done:
                err(w, "no choice ends the lab (next: \"done\")")
    for num, d in loaded.items():
        for g in d.get("glossary", []):
            if not (g.get("term") and g.get("def")):
                err(f"module {num} glossary", "needs term and def")
            if g.get("lesson") and g["lesson"] not in lesson_ids:
                err(f"module {num} glossary {g['term']}", f"lesson {g['lesson']} does not exist")
        for c in d.get("commands", []):
            if c.get("lesson") and c["lesson"] not in lesson_ids:
                err(f"module {num} command {c['cmd']}", f"lesson {c['lesson']} does not exist")
    if "--fix" in sys.argv:
        with open(os.path.join(ROOT, "index.json"), "w") as f:
            json.dump(idx, f, indent=1, ensure_ascii=False)
            f.write("\n")
    for e in errors:
        print("ERROR", e)
    print(f"{len(loaded)} module files, {len(lesson_ids)} lessons, {len(errors)} problems")
    sys.exit(1 if errors else 0)


main()
