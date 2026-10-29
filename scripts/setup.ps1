# Starts Oracle XE (Docker) and deploys the full BankCore schema.
. "$PSScriptRoot\_env.ps1"

New-Item -ItemType Directory -Force -Path "backup" | Out-Null

Write-Host "==> Demarrage du conteneur Oracle XE..."
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose a echoue (Docker Desktop est-il lance ?)" }

Write-Host "==> Attente de la base (1er demarrage : 1 a 3 minutes)..."
$waited = 0
do {
    Start-Sleep -Seconds 5
    $waited += 5
    $status = docker inspect -f '{{.State.Health.Status}}' $script:Container
    if ($waited -ge 600) { throw "La base n'est pas prete apres 10 minutes. Consultez : docker logs $($script:Container)" }
} until ($status -eq "healthy")

$deployed = (& docker exec -i -e NLS_LANG=.AL32UTF8 $script:Container sqlplus -s (Get-SysConnect) "@/opt/sql/08_is_deployed.sql" | Out-String).Trim()
if ($deployed -eq "1") {
    Write-Host "BankCore est deja deploye dans cette base : rien a faire."
    Write-Host "Pour repartir de zero : docker compose down -v, puis relancer ce script."
    return
}

Write-Host "==> 01 Utilisateurs, roles, profil"
Invoke-Sql -Connect (Get-SysConnect) -File "01_users.sql" -SqlArgs @(
    $env:BANK_OWNER_PASSWORD,
    $env:BANK_APP_PASSWORD,
    $env:BANK_AUDITOR_PASSWORD
)

foreach ($f in "02_schema.sql", "03_pkg_bank.sql", "04_triggers.sql", "05_views_grants.sql", "06_seed.sql", "07_tests.sql") {
    Write-Host "==> $f"
    Invoke-Sql -Connect (Get-OwnerConnect) -File $f
}

Write-Host ""
Write-Host "BankCore est pret. Lancez l'API :"
Write-Host "  pip install -r api\requirements.txt   (une seule fois)"
Write-Host "  .\scripts\run_api.ps1"
