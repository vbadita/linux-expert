# Changelog

## 2026-11-08: all 49 modules
Every module of the curriculum is written, with every command run for real and its output recorded
(Oracle Linux 9.8, kernel 6.12 UEK, aarch64, bash 5.1). Totals: 119 lessons, 10 troubleshooting labs, 277 interview
questions, a 20-question random final exam drawn from every lesson quiz plus 41 extra mixed questions.

Modules 8, 9, 10, 15 and 17 were **not** supplied (the earlier request contained only a placeholder), so they were
written from scratch with the same rules as the others. If you have your own verified text for them, replace those files.

| # | Module | Content | Interview Q |
|---|---|---|---|
| 1 | The shell | 4 lessons | 10 |
| 2 | Filesystem hierarchy | 3 lessons | 5 |
| 3 | Files and permissions | 3 lessons | 6 |
| 4 | Users and groups | 2 lessons | 6 |
| 5 | Text processing | 3 lessons | 6 |
| 6 | Editors | 2 lessons | 5 |
| 7 | Package management | 3 lessons | 6 |
| 8 | System calls and strace | 3 lessons | 6 |
| 9 | Processes | 3 lessons | 6 |
| 10 | Process states, ps, sessions, daemons, zombies | 3 lessons | 6 |
| 11 | Signals | 3 lessons | 6 |
| 12 | Threads and the CPU scheduler | 3 lessons | 6 |
| 13 | Kernel modules, sysctl, /proc and /sys | 3 lessons | 6 |
| 14 | Building and booting a custom kernel | 2 lessons | 5 |
| 15 | Memory | 3 lessons | 6 |
| 16 | Advanced memory | 3 lessons | 6 |
| 17 | File descriptors and the VFS | 3 lessons | 6 |
| 18 | Inodes and links | 3 lessons | 6 |
| 19 | Disks and partitions | 3 lessons | 6 |
| 20 | Filesystems | 3 lessons | 6 |
| 21 | LVM | 2 lessons | 4 |
| 22 | RAID, I/O schedulers, iostat | 2 lessons | 3 |
| 23 | NFS, iSCSI and network storage | 2 lessons | 6 |
| 24 | The boot process | 2 lessons | 6 |
| 25 | systemd in depth | 3 lessons | 6 |
| 26 | Logging | 3 lessons | 6 |
| 27 | Scheduling | 2 lessons | 6 |
| 28 | Network basics in Linux | 2 lessons | 6 |
| 29 | TCP/IP inside the kernel | 2 lessons | 6 |
| 30 | DNS | 2 lessons | 6 |
| 31 | Firewalls | 2 lessons | 6 |
| 32 | Network troubleshooting | 2 lessons | 6 |
| 33 | SSH in depth | 3 lessons | 6 |
| 34 | The Linux security model | 3 lessons | 6 |
| 35 | SELinux and AppArmor | 3 lessons | 6 |
| 36 | Hardening | 3 lessons | 6 |
| 37 | Namespaces | 2 lessons | 6 |
| 38 | cgroups | 2 lessons | 6 |
| 39 | Containers from scratch | 2 lessons | 6 |
| 40 | Virtualization | 2 lessons | 5 |
| 41 | Performance methodology | 2 lessons | 6 |
| 42 | CPU performance | 2 lessons | 6 |
| 43 | Memory and I/O performance | 2 lessons | 6 |
| 44 | Tracing | 2 lessons | 6 |
| 45 | Bash scripting | 3 lessons | 6 |
| 46 | Advanced bash | 2 lessons | 6 |
| 47 | Ansible basics | 2 lessons | 6 |
| 48 | Troubleshooting labs | 10 labs | 0 |
| 49 | Final exam | 41 extra exam questions | 0 |

Steps that cannot be run safely (a reboot, a D-state hang on a real failing disk, AppArmor on this kernel, KVM without
/dev/kvm, building a kernel) are marked **explanation only** with the reason.

## Platform (2026-11-07)
- Static site: lesson stepper, simulated terminal, copy buttons, "Try it on your machine", quizzes,
  "Check yourself", level badges, interview page, cheat sheet, glossary, learning path, search,
  troubleshooting labs, final exam, progress in localStorage with reset. Light and dark mode.
- Authoring tools: `scripts/capture.py` (records real output, refuses to store host identifiers), `scripts/validate.py`.
- Deployment files for apps.badita.com/linux (pull-based, like bash-sim).
- Browser tests: `tests/e2e.mjs` (light/dark, desktop/phone, CSP).
