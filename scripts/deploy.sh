#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/VietTutor-Studio"
SERVICE_NAME="vietutor-studio"
RUN_DB_PUSH="false"
DB_PATH="$APP_DIR/prisma/dev.db"
BACKUP_ROOT="/var/backups/vietutor-studio"

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

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked files contain local changes; refusing to overwrite them." >&2
  exit 1
fi

echo "==> Pulling latest code (fast-forward only)"
git pull --ff-only

echo "==> Installing dependencies from lockfile"
npm ci

echo "==> Validating production environment"
npm run env:check

echo "==> Running release checks"
npm run check

if [[ "$RUN_DB_PUSH" == "true" ]]; then
  if [[ ! -f "$DB_PATH" ]]; then
    echo "SQLite database not found at $DB_PATH; refusing schema update." >&2
    exit 1
  fi

  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 is required for a consistent pre-migration backup." >&2
    exit 1
  fi

  backup_stamp="$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_ROOT"
  backup_path="$BACKUP_ROOT/dev-$backup_stamp.db"
  echo "==> Backing up SQLite database to: $backup_path"
  sqlite3 "$DB_PATH" ".backup '$backup_path'"

  echo "==> Applying Prisma schema changes"
  npm run db:push
fi

echo "==> Building production bundle"
npm run build

echo "==> Restarting service: $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "==> Verifying service and health endpoint"
systemctl is-active --quiet "$SERVICE_NAME"
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:3000/api/health >/dev/null
systemctl status "$SERVICE_NAME" --no-pager
