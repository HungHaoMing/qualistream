#!/bin/sh
set -eu
app_password="$(cat /run/secrets/postgres_app_password)"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 --set=app_password="$app_password" <<'SQL'
CREATE ROLE qualistream_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
GRANT CONNECT ON DATABASE qualistream TO qualistream_app;
GRANT USAGE, CREATE ON SCHEMA public TO qualistream_app;
SQL
