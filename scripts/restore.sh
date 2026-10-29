#!/usr/bin/env bash
# Restaure BANK_OWNER depuis une sauvegarde. ATTENTION : le schéma actuel est supprimé.
# Usage : bash scripts/restore.sh bankcore_20261019_143000.dmp
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

dump="${1:?Usage : bash scripts/restore.sh <fichier.dmp>}"
[ -f "backup/$dump" ] || { echo "Fichier introuvable : backup/$dump"; exit 1; }

read -r -p "Le schéma BANK_OWNER va être supprimé puis restauré depuis $dump. Taper OUI pour continuer : " answer
[ "$answer" = "OUI" ] || { echo "Annulé."; exit 0; }

echo "==> Suppression du schéma actuel"
run_sql "$(sys_connect)" 90_drop_owner.sql

echo "==> Import Data Pump"
docker exec "$CONTAINER" impdp "system/${ORACLE_PASSWORD}@${SERVICE}" \
  schemas=bank_owner directory=bank_backup_dir dumpfile="$dump" logfile="restore_$(date +%Y%m%d_%H%M%S).log" \
  || echo "impdp a terminé avec des avertissements (voir backup/restore_*.log)"

echo "==> Vérification (tests de non-régression)"
run_sql "$(owner_connect)" 07_tests.sql
echo "Restauration terminée."
