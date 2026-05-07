#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/VietTutor-Studio"
SERVICE_NAME="vietutor-studio"
RUN_DB_PUSH="false"

for arg in "$@"; do
  case "$arg" in
    --with-db-push)
      RUN_DB_PUSH="true"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--with-db-push]" >&2
      exit 1
      ;;
  esac
done

echo "==> Switching to app directory: $APP_DIR"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull

echo "==> Installing dependencies from lockfile"
npm ci

if [[ "$RUN_DB_PUSH" == "true" ]]; then
  echo "==> Applying Prisma schema changes"
  npm run db:push
fi

echo "==> Building production bundle"
npm run build

echo "==> Restarting service: $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "==> Current service status"
systemctl status "$SERVICE_NAME" --no-pager
