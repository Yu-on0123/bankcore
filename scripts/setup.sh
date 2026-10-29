#!/usr/bin/env bash
# Démarre Oracle XE (Docker) et déploie tout le schéma BankCore. Usage : bash scripts/setup.sh
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

command -v docker >/dev/null || { echo "Docker est introuvable : installez-le puis relancez."; exit 1; }

mkdir -p backup
chmod 777 backup   # l'utilisateur "oracle" du conteneur doit pouvoir y écrire (sous Linux)

echo "==> Démarrage du conteneur Oracle XE..."
docker compose up -d

echo "==> Attente de la base (1er démarrage : 1 à 3 minutes)..."
waited=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" = "healthy" ]; do
  if [ "$waited" -ge 600 ]; then
    echo "La base n'est pas prête après 10 minutes. Consultez : docker logs $CONTAINER"
    exit 1
  fi
  sleep 5; waited=$((waited + 5))
done

deployed="$(run_sql "$(sys_connect)" 08_is_deployed.sql | tr -d '[:space:]')"
if [ "$deployed" = "1" ]; then
  echo "BankCore est déjà déployé dans cette base : rien à faire."
  echo "Pour repartir de zéro : docker compose down -v, puis relancer ce script."
  exit 0
fi

echo "==> 01 Utilisateurs, rôles, profil"
run_sql "$(sys_connect)" 01_users.sql "$BANK_OWNER_PASSWORD" "$BANK_APP_PASSWORD" "$BANK_AUDITOR_PASSWORD"

for f in 02_schema.sql 03_pkg_bank.sql 04_triggers.sql 05_views_grants.sql 06_seed.sql 07_tests.sql; do
  echo "==> $f"
  run_sql "$(owner_connect)" "$f"
done

echo
echo "BankCore est prêt. Lancez l'API : bash scripts/run_api.sh"
