# Sauvegarde logique du schéma BANK_OWNER avec Data Pump (expdp).
# Le fichier .dmp est écrit dans ./backup. Les sauvegardes de plus de 14 jours sont supprimées.
param([int]$KeepDays = 14)
. "$PSScriptRoot\_env.ps1"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dump  = "bankcore_$stamp.dmp"
$log   = "bankcore_$stamp.log"

Write-Host "==> Export Data Pump : $dump"
docker exec $script:Container expdp "system/$($env:ORACLE_PASSWORD)@$($script:Service)" `
    schemas=bank_owner directory=bank_backup_dir dumpfile=$dump logfile=$log
if ($LASTEXITCODE -ne 0) { throw "expdp a échoué, voir backup\$log" }

Get-ChildItem "backup" -Filter "bankcore_*.dmp" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Force

Write-Host "Sauvegarde terminée : backup\$dump"
