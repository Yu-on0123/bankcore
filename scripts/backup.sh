#!/usr/bin/env bash
# Sauvegarde Data Pump du schéma BANK_OWNER dans ./backup (conserve 14 jours).
# Usage : bash scripts/backup.sh
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

stamp="$(date +%Y%m%d_%H%M%S)"
dump="bankcore_${stamp}.dmp"

echo "==> Export Data Pump : $dump"
docker exec "$CONTAINER" expdp "system/${ORACLE_PASSWORD}@${SERVICE}" \
  schemas=bank_owner directory=bank_backup_dir dumpfile="$dump" logfile="bankcore_${stamp}.log"

find backup -name 'bankcore_*.dmp' -mtime +14 -delete
echo "Sauvegarde terminée : backup/$dump"
