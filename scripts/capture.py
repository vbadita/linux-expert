#!/usr/bin/env python3
"""Run every command in a module file for real and write the captured output back.

usage: scripts/capture.py site/content/01-shell.json [--force] [--only LESSON_OR_LAB_ID]

How it works
- Each lesson (and each lab) runs in ONE persistent `bash --noprofile --norc` session,
  so variables, cwd and files carry from step to step, exactly as for a learner.
- The session starts in a fresh /tmp/lab. The lesson's `setup.commands` run first.
- A step with `code` {file, src} writes that source into the session's current directory before its runs.
- Every run {cmd} gets stdout+stderr recorded. A lesson with any missing output is re-run
  completely (steps depend on each other). --force re-records everything.
- Runs with "explanationOnly": true are never executed.
- Outputs that contain host identifiers (hostname, IPs, MACs, machine-id) abort the capture.
- Labs may have `build` (commands run first, may use sudo) and `teardown`.
- `env` at the top of the module is refreshed with the machine the output came from.
"""
import json, os, platform, re, select, shutil, subprocess, sys, time, uuid

WORK = "/tmp/lab"
MARK = "__END_" + uuid.uuid4().hex[:8] + "__"


def unmount_leftovers():
    """A failed lesson may leave tmpfs/loop mounts under /tmp/lab; remove them before starting over."""
    r = subprocess.run("findmnt -rn -o TARGET", shell=True, capture_output=True, text=True)
    for t in sorted((x for x in r.stdout.split() if x.startswith(WORK + "/")), reverse=True):
        subprocess.run(["sudo", "umount", t], check=False)


class Session:
    def __init__(self):
        unmount_leftovers()
        shutil.rmtree(WORK, ignore_errors=True)
        os.makedirs(WORK)
        # Interactive mode (-i) so messages read like a terminal ("bash: x: command not found",
        # no script file name). Input comes from a pipe, so commands must not read stdin.
        env = dict(os.environ, PS1="", PS2="", HISTFILE="/dev/null")
        self.p = subprocess.Popen(["bash", "--noprofile", "--norc", "--noediting", "-i"], cwd=WORK, env=env, stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=False, bufsize=0)

    def start(self):
        self.run("set +H")  # drains the "no job control" start-up noise; discard it
        return self

    def run(self, cmd, timeout=300):
        time.sleep(0.4)  # a human takes a moment between commands; lets killed processes exit
        # rc=$? ... (exit $rc) keeps $? intact for the next command, like at a prompt
        self.p.stdin.write((cmd + f"\nrc=$?; printf '\\n{MARK}%s\\n' \"$rc\"; (exit $rc)\n").encode())
        data = b""
        end = time.time() + timeout
        fd = self.p.stdout.fileno()
        tag = ("\n" + MARK).encode()
        # read raw bytes: select() on a buffered text stream can miss data already buffered
        while True:
            i = data.find(tag)
            if i >= 0 and data.find(b"\n", i + 1) >= 0:
                break
            left = end - time.time()
            if left <= 0:
                self.p.kill()
                raise RuntimeError(f"timeout running: {cmd}")
            r, _, _ = select.select([fd], [], [], left)
            if r:
                chunk = os.read(fd, 65536)
                if not chunk:
                    raise RuntimeError(f"shell exited during: {cmd}")
                data += chunk
        rc = int(data[i + len(tag):].split(b"\n")[0])
        out = data[:i].decode("utf-8", "replace")
        # artifact of an interactive bash that reads from a pipe: a real terminal never prints it
        out = "\n".join(l for l in out.split("\n") if "tcsetattr: Inappropriate ioctl" not in l)
        return out.rstrip("\n"), rc

    def close(self):
        try:
            self.p.stdin.close()
            self.p.wait(timeout=5)
        except Exception:
            self.p.kill()
        shutil.rmtree(WORK, ignore_errors=True)


def host_secrets():
    """Strings that identify THIS machine. The site is public, so they must never be recorded."""
    out = set()
    for cmd in ("hostname", "hostname -f", "cat /etc/machine-id",
                "ip -o addr | awk '$2!=\"lo\"{print $4}' | cut -d/ -f1",
                "cat /sys/class/net/*/address | grep -v '^00:00:00:00:00:00$'"):
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        out |= {x.strip() for x in r.stdout.split() if len(x.strip()) > 3}
    out |= {"rc-workspace", ".claude", "ocir.io", "frjpwv", "valentin", "169.254.169.254"}
    return out


SECRETS = None
ALLOWED_IP = re.compile(r"^(127\.|0\.|10\.(200|201|99)\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|255\.|224\.)")
IPV4 = re.compile(r"(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.])")


def check_leaks(cmd, out, r):
    global SECRETS
    if SECRETS is None:
        SECRETS = host_secrets()
    bad = [s for s in SECRETS if s in out]
    if r.get("ok") != "ip":
        bad += [m for m in IPV4.findall(out) if all(int(x) < 256 for x in m.split(".")) and not ALLOWED_IP.match(m)]
    if bad:
        sys.exit(f"LEAK in output of `{cmd.splitlines()[0][:60]}`: {sorted(set(bad))}\n"
                 "Change the command (use netns/loopback/documentation addresses) or set \"ok\": \"ip\" for a version string.")


def must(sess, cmd, what):
    out, rc = sess.run(cmd)
    if rc != 0:
        sys.exit(f"{what} failed (exit {rc}):\n{cmd}\n{out}")


def do_run(sess, r, force, label):
    if r.get("explanationOnly") or ("output" in r and not force):
        return 0
    out, rc = sess.run(r["cmd"])
    check_leaks(r["cmd"], out, r)
    r["output"] = out
    print(f"  [{rc}] {label}: {r['cmd'].splitlines()[0][:70]}")
    return 1


def missing(runs):
    return any(not r.get("explanationOnly") and "output" not in r for r in runs)


def capture_lesson(lesson, force):
    # steps depend on earlier steps (files, variables), so if ANY output is missing the
    # whole lesson is re-run from a clean directory and re-recorded
    runs = [r for s in lesson["steps"] for r in ([s["run"]] if isinstance(s.get("run"), dict) else s.get("run") or [])]
    force = force or missing(runs)
    sess = Session().start()
    n = 0
    try:
        for c in (lesson.get("setup") or {}).get("commands", []):
            must(sess, c, "setup")
        for step in lesson["steps"]:
            if step.get("code") and step["code"].get("file"):
                cwd = sess.run("pwd")[0].strip() or WORK      # the learner saves it where they are
                with open(os.path.join(cwd, step["code"]["file"]), "w") as f:
                    f.write(step["code"]["src"])
            for r in ([step["run"]] if isinstance(step.get("run"), dict) else step.get("run") or []):
                n += do_run(sess, r, force, lesson["id"])
    finally:
        sess.close()
    return n


def capture_lab(lab, force):
    force = force or missing([c for st in lab["steps"] for c in st["choices"]])
    sess = Session().start()
    n = 0
    try:
        for c in lab.get("build", []):
            must(sess, c, "lab build")
        for si, step in enumerate(lab["steps"]):
            for ch in step["choices"]:
                n += do_run(sess, ch, force, f"{lab['id']}#{si + 1}")
    finally:
        for c in lab.get("teardown", []):
            try:
                sess.run(c)
            except Exception as e:  # best effort
                print("teardown failed:", e)
        sess.close()
    return n


def machine():
    osr = {}
    try:
        for line in open("/etc/os-release"):
            k, _, v = line.strip().partition("=")
            osr[k] = v.strip('"')
    except OSError:
        pass
    bashv = subprocess.run(["bash", "-c", "echo $BASH_VERSION"], capture_output=True, text=True).stdout.strip()
    return f"{osr.get('PRETTY_NAME', 'Linux')}, kernel {platform.release()} ({platform.machine()}), bash {bashv}"


def main():
    # captures share /tmp/lab, so two at once would corrupt each other: take a lock
    import fcntl
    lock = open("/tmp/capture.lock", "w")
    fcntl.flock(lock, fcntl.LOCK_EX)
    argv = sys.argv[1:]
    force = "--force" in argv
    only = argv[argv.index("--only") + 1] if "--only" in argv else None
    args = [a for a in argv if not a.startswith("--") and a != only]
    if not args:
        sys.exit(__doc__)
    for path in args:
        data = json.load(open(path))
        total = 0
        for l in data.get("lessons", []):
            if only and l["id"] != only:
                continue
            print(f"{path}: lesson {l['id']}")
            total += capture_lesson(l, force)
        for lab in data.get("labs", []):
            if only and lab["id"] != only:
                continue
            print(f"{path}: lab {lab['id']}")
            total += capture_lab(lab, force)
        if total or force or not data.get("env"):
            data["env"] = machine()
        with open(path, "w") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
            f.write("\n")
        print(f"{path}: recorded {total} outputs")


if __name__ == "__main__":
    main()
