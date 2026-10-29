# Restaure le schéma BANK_OWNER depuis une sauvegarde Data Pump.
# ATTENTION : le schéma actuel est supprimé puis recréé à partir du fichier.
# Usage : .\scripts\restore.ps1 bankcore_20261019_143000.dmp
param([Parameter(Mandatory = $true)][string]$DumpFile)
. "$PSScriptRoot\_env.ps1"

if (-not (Test-Path "backup\$DumpFile")) { throw "Fichier introuvable : backup\$DumpFile" }

$answer = Read-Host "Le schéma BANK_OWNER va être supprimé puis restauré depuis $DumpFile. Taper OUI pour continuer"
if ($answer -ne "OUI") { Write-Host "Annulé."; return }

Write-Host "==> Suppression du schéma actuel"
Invoke-Sql (Get-SysConnect) "90_drop_owner.sql"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Write-Host "==> Import Data Pump"
docker exec $script:Container impdp "system/$($env:ORACLE_PASSWORD)@$($script:Service)" `
    schemas=bank_owner directory=bank_backup_dir dumpfile=$DumpFile logfile="restore_$stamp.log"
if ($LASTEXITCODE -ne 0) { Write-Warning "impdp a terminé avec des avertissements, voir backup\restore_$stamp.log" }

Write-Host "==> Vérification (tests de non-régression)"
Invoke-Sql (Get-OwnerConnect) "07_tests.sql"
Write-Host "Restauration terminée."
