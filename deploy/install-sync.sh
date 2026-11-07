#!/usr/bin/env bash
# Install the pull-based site deploy on the VM (user, dirs, SELinux, timer, nginx). Re-runnable.
#   sudo -v && deploy/install-sync.sh   (from a checkout of this repository)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
id linux-web >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin linux-web
sudo install -d -m 0755 -o linux-web -g linux-web /srv/linux-expert /srv/linux-expert/releases
if command -v semanage >/dev/null 2>&1; then
  if ! sudo semanage fcontext -l | grep -q '^/srv/linux-expert(/.\*)?'; then
    sudo semanage fcontext -a -t httpd_sys_content_t '/srv/linux-expert(/.*)?'
  fi
  sudo restorecon -R /srv/linux-expert
fi
sudo install -m 0755 "$root/deploy/linux-site-sync.sh" /usr/local/libexec/linux-site-sync
sudo install -m 0644 "$root/deploy/systemd/linux-site-sync.service" "$root/deploy/systemd/linux-site-sync.timer" /etc/systemd/system/
sudo install -m 0644 "$root/deploy/nginx/linux.conf" "$root/deploy/nginx/linux-headers.inc" /etc/nginx/apps.badita.com.d/
sudo systemctl daemon-reload
sudo systemctl enable -q --now linux-site-sync.timer
sudo systemctl start linux-site-sync.service   # first pull now (needs branch "site" on GitHub)
sudo nginx -t
sudo systemctl reload nginx
echo "installed; live release: $(readlink /srv/linux-expert/linux || echo none yet)"
