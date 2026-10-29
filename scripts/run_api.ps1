# Lance l'API avec les mots de passe du fichier .env. Usage : .\scripts\run_api.ps1
. "$PSScriptRoot\_env.ps1"

Set-Location "api"
python app.py
