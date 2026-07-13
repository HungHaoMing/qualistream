#!/bin/sh
set -eu
stamp="$(date -u +%Y%m%dT%H%M%SZ)"; plain="/backups/qualistream-${stamp}.dump"; encrypted="${plain}.gpg"
export PGPASSWORD="$(cat /run/secrets/postgres_app_password)"
if pg_dump --format=custom --no-owner --no-acl --file="$plain" "$PGDATABASE" && gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file /run/secrets/backup_passphrase --output "$encrypted" "$plain"; then
  rm -f "$plain"; cp "$encrypted" /offsite/; printf 'success %s\n' "$stamp" > "${BACKUP_STATUS_FILE:-/offsite/last-backup-status}"; find /backups -name 'qualistream-*.dump.gpg' -mtime "+${BACKUP_RETENTION_DAYS:-400}" -delete
else rm -f "$plain"; printf 'failure %s\n' "$stamp" > "${BACKUP_STATUS_FILE:-/offsite/last-backup-status}"; exit 1; fi
