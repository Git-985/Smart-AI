#!/usr/bin/env bash
# Smart AI production bootstrap for Ubuntu 22.04 / 24.04.
# Usage:
#   DOMAIN=demo.example.com bash bootstrap.sh /root/smartai-src.zip
# The zip must contain the project at its root, including a deploy/ directory.

set -Eeuo pipefail

DOMAIN="${DOMAIN:-}"
SRC_ZIP="${1:-/root/smartai-src.zip}"
APP_ROOT="/opt/smartai"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ -n "$DOMAIN" ] || fail "DOMAIN is required, e.g. DOMAIN=demo.example.com bash bootstrap.sh"
[ -f "$SRC_ZIP" ] || fail "source zip not found: $SRC_ZIP"

log "1/7 install base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl unzip ufw gnupg lsb-release

log "2/7 ensure 2G swap (Next.js build needs headroom on 2C2G)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "swap enabled"
else
  echo "swap already present"
fi

log "3/7 install Docker Engine and Compose v2"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun || true
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "get.docker.com failed, falling back to Aliyun Docker CE repo"
  . /etc/os-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
docker --version

if ! docker compose version >/dev/null 2>&1; then
  echo "Compose v2 missing, trying docker-compose-plugin"
  apt-get install -y docker-compose-plugin || true
fi
docker compose version || fail "docker compose v2 is required"

log "4/7 open firewall ports 22/80/443"
SSH_PORT="$(printf '%s' "${SSH_CONNECTION:-}" | awk '{print $4}')"
[ -n "${SSH_PORT:-}" ] && ufw allow "${SSH_PORT}/tcp" || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "5/7 unpack source"
mkdir -p "$APP_ROOT"
unzip -oq "$SRC_ZIP" -d "$APP_ROOT"
[ -f "$APP_ROOT/Dockerfile" ] || fail "Dockerfile missing after unzip; check zip layout"
[ -f "$APP_ROOT/deploy/docker-compose.prod.yml" ] || fail "deploy files missing after unzip"

log "6/7 configure domain and build"
cd "$APP_ROOT/deploy"
printf 'DOMAIN=%s\n' "$DOMAIN" > .env
docker compose -f docker-compose.prod.yml up -d --build

log "7/7 wait for the app health endpoint"
HEALTHY=0
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$HEALTHY" -eq 1 ]; then
  echo "app is healthy:"
  curl -fsS http://127.0.0.1:3000/api/health
  echo
else
  echo "app did not become healthy in 120s; showing logs"
  docker compose -f docker-compose.prod.yml logs --tail=80 app
fi

echo
docker compose -f docker-compose.prod.yml ps
echo
echo "Public URL: https://$DOMAIN"
echo "If the certificate is not ready, wait 30-60s and run:"
echo "  curl -I https://$DOMAIN"
echo
echo "Useful commands:"
echo "  cd $APP_ROOT/deploy && docker compose -f docker-compose.prod.yml logs -f --tail=100"
echo "  cd $APP_ROOT/deploy && docker compose -f docker-compose.prod.yml restart"
