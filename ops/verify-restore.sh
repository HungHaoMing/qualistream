#!/bin/sh
set -eu
test -n "${BACKUP_FILE:-}"; test -n "${RESTORE_DATABASE_URL:-}"
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
gpg --batch --yes --decrypt --passphrase-file /run/secrets/backup_passphrase --output "$tmp" "$BACKUP_FILE"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$tmp"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM projects) projects,(SELECT count(*) FROM interviews) interviews,(SELECT count(*) FROM segments) segments,(SELECT count(*) FROM codings) codings;"
