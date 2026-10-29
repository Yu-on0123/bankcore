# Common helpers (dot-source: . "$PSScriptRoot\_env.ps1")
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Fichier .env cree depuis .env.example (pensez a changer les mots de passe)."
}

# Load .env into process environment
Get-Content ".env" | Where-Object { $_ -match '^\s*[^#\s].*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    Set-Item -Path "env:$($k.Trim())" -Value $v.Trim()
}

$script:Container = "bankcore-db"
$script:Service   = "//localhost:1521/XEPDB1"

function Invoke-Sql {
    param(
        [Parameter(Mandatory)][string]$Connect,
        [Parameter(Mandatory)][string]$File,
        [string[]]$SqlArgs = @()
    )
    # Pass each token as its own argument so "as sysdba" stays inside the connect string
    # and positional SQL*Plus args (&1 &2 &3) are not shifted.
    $dockerArgs = @(
        "exec", "-i",
        "-e", "NLS_LANG=.AL32UTF8",
        $script:Container,
        "sqlplus", "-s",
        $Connect,
        "@/opt/sql/$File"
    )
    if ($SqlArgs.Count -gt 0) {
        $dockerArgs += $SqlArgs
    }

    & docker @dockerArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Echec de l'execution de $File (code $LASTEXITCODE)"
    }
}

function Get-SysConnect {
    # Single string (no extra spaces around / and @) — kept as one array element
    "sys/$($env:ORACLE_PASSWORD)@$($script:Service) as sysdba"
}

function Get-OwnerConnect {
    "bank_owner/$($env:BANK_OWNER_PASSWORD)@$($script:Service)"
}
