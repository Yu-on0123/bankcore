#!/usr/bin/env bash
# Lance l'API avec les mots de passe du fichier .env. Usage : bash scripts/run_api.sh
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"
cd api
exec python3 app.py
