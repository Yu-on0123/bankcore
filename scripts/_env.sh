#!/usr/bin/env bash
# Common helpers (source scripts/_env.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Fichier .env cree depuis .env.example (pensez a changer les mots de passe)."
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

CONTAINER="bankcore-db"
SERVICE="//localhost:1521/XEPDB1"

sys_connect()   { echo "sys/${ORACLE_PASSWORD}@${SERVICE} as sysdba"; }
owner_connect() { echo "bank_owner/${BANK_OWNER_PASSWORD}@${SERVICE}"; }

# run_sql "<connect string>" file.sql [positional args for &1 &2 ...]
run_sql() {
  local connect="$1" file="$2"
  shift 2
  docker exec -i -e NLS_LANG=.AL32UTF8 "$CONTAINER" \
    sqlplus -s "$connect" "@/opt/sql/$file" "$@"
}
