#!/bin/sh
set -eu
while true; do /ops/backup.sh || true; sleep 86400; done
