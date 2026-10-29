# BankCore — administration Oracle & PL/SQL d'un module bancaire

🇫🇷 **Français** · 🇬🇧 [English](README.en.md)

[![Tests](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
![Oracle](https://img.shields.io/badge/Oracle%20XE-21c-f80000)
![PL/SQL](https://img.shields.io/badge/PL%2FSQL-package%20%2B%20triggers-blue)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab)
![Flask](https://img.shields.io/badge/Flask-3-000000)
![Licence](https://img.shields.io/badge/licence-MIT-green)

Un module bancaire construit **autour de la base de données** : la logique métier, la sécurité, l'audit et les sauvegardes vivent dans **Oracle**. Une petite **API Python (Flask)** appelle le package PL/SQL, et une **interface web de guichet** s'appuie sur cette API. Chaque refus (solde insuffisant, compte bloqué…) vient de la base, pas du code applicatif.

  **[Voir la démo en ligne](https://bankcore-xkfy.onrender.com/)** — version de démonstration sans Oracle (données fictives en mémoire). L'architecture complète Oracle + PL/SQL se lance avec Docker, voir plus bas. Première visite lente sur le plan gratuit (une trentaine de secondes).

| Guichet (thème clair, français) | Guichet (thème sombre, anglais) |
|---|---|
| ![Guichet, thème clair](docs/screenshots/desk-light-fr.png) | ![Guichet, thème sombre](docs/screenshots/desk-dark-en.png) |

| Journal d'audit | Mobile (390 px) |
|---|---|
| ![Journal d'audit](docs/screenshots/audit-light-fr.png) | <img src="docs/screenshots/mobile-light-fr.png" alt="Guichet sur mobile" width="240"> |

_Captures réalisées avec le serveur de démonstration (`dev_mock.py`, données fictives)._

## Ce que le projet démontre

- **Modélisation relationnelle** : clés, contraintes `CHECK` (par exemple `balance >= -overdraft_limit`), index, commentaires (`sql/02_schema.sql`).
- **PL/SQL avancé** : package `BANK_PKG`, exceptions métier `ORA-20001` à `20006`, `SELECT … FOR UPDATE`, ordre de verrouillage anti-deadlock pour les virements, `SYS_REFCURSOR` (`sql/03_pkg_bank.sql`).
- **Triggers** : audit automatique des soldes, journal comptable immuable, suppression de compte interdite, normalisation des emails (`sql/04_triggers.sql`).
- **Sécurité et privilèges** : rôles `ROLE_TELLER` et `ROLE_AUDITOR`, moindre privilège, profil de verrouillage après 5 échecs de connexion (`sql/01_users.sql`, `sql/05_views_grants.sql`).
- **Sauvegarde et restauration** : Data Pump (`expdp` / `impdp`) en PowerShell et en Bash, avec tests rejoués après restauration.
- **Intégration propre** : une API REST qui n'appelle que le package, jamais les tables ; erreurs renvoyées avec un code stable, traduit côté interface.
- **Interface soignée** : HTML/CSS/JS sans framework ni build, bilingue FR / EN, thème clair/sombre, responsive (390 → 1440 px), navigation clavier, polices embarquées.
- **Tests** : 11 contrôles SQL sur la base, 36 tests `pytest` sans Oracle, exécutés automatiquement par GitHub Actions.

## Architecture

```
Navigateur ──► Flask (api/app.py) ──► Oracle XE (conteneur Docker)
                 │                      ├─ BANK_OWNER : tables, package, triggers, vues
                 ├─ BANK_APP     ─────► ├─ ROLE_TELLER  : EXECUTE bank_pkg + SELECT v_account_summary, v_client_summary
                 └─ BANK_AUDITOR ─────► └─ ROLE_AUDITOR : SELECT seul (vues, audit, transactions)
```

L'utilisateur applicatif `BANK_APP` n'a **aucun droit direct sur les tables** : il ne peut qu'appeler les procédures du package, donc respecter les règles métier.

```
bankcore/
├── sql/             schéma, package, triggers, vues et droits, jeu de données, tests
├── scripts/         installation, sauvegarde, restauration, lancement de l'API (PowerShell et Bash)
├── api/
│   ├── app.py       API Flask (connectée à Oracle)
│   ├── dev_mock.py  serveur de démonstration sans Oracle
│   ├── tests/       tests pytest (API à pool simulé, serveur de démo)
│   └── static/      interface (index.html, css/, js/ dont i18n.js, fonts/)
├── docs/            captures d'écran du README
├── .github/         intégration continue
├── Dockerfile       image de la démo en ligne (sans Oracle)
├── docker-compose.yml, .devcontainer/, .env.example
└── LICENSE
```

## Choix techniques

- **Pourquoi tout dans la base** : une règle métier écrite dans le package s'applique quel que soit le client (API, script SQL, autre application). Les contraintes `CHECK` et les triggers la garantissent même si le code applicatif se trompe.
- **Pourquoi un package et aucun droit sur les tables** : `BANK_APP` ne peut pas contourner les règles. Un guichetier compromis ne peut ni modifier un solde à la main, ni supprimer une écriture.
- **Pourquoi verrouiller les comptes dans l'ordre de leurs numéros** : deux virements croisés (A→B et B→A) prendraient les verrous dans des ordres opposés et se bloqueraient mutuellement. Un ordre déterministe supprime ce cas.
- **Pourquoi un journal de transactions immuable et un audit par trigger** : l'historique ne peut être ni réécrit ni oublié par l'application ; chaque changement de solde, de statut ou de découvert est tracé avec l'utilisateur, l'adresse IP et la date.
- **Pourquoi une API fine et sans framework front** : l'interface se résume à des tableaux et quelques formulaires. HTML/CSS/JS suffit, sans étape de build, et l'ensemble est servi par la même application Flask.
- **Pourquoi des erreurs à code stable** : `{"error": "…", "code": "insufficient_funds"}` garde un message lisible en français et un code indépendant de la langue, que l'interface traduit en français ou en anglais.

## Fonctionnement de la base

### Modèle de données

`CLIENTS` 1—n `ACCOUNTS` 1—n `TRANSACTIONS`, plus `AUDIT_LOG` (rempli uniquement par trigger). La contrainte `CHECK (balance >= -overdraft_limit)` garantit en base qu'un solde ne dépasse jamais le découvert autorisé.

### Package `BANK_PKG`

| Sous-programme | Rôle |
|---|---|
| `create_client` | Crée un client (email unique, normalisé) |
| `open_account` | Ouvre un compte courant (avec découvert) ou épargne (jamais de découvert), dépôt initial optionnel |
| `deposit`, `withdraw` | Mouvements avec verrou de ligne et contrôle du solde |
| `transfer` | Virement atomique ; verrous pris dans l'ordre des numéros de compte (pas de deadlock) |
| `get_balance`, `statement` | Consultation (le relevé renvoie un `SYS_REFCURSOR`) |

Erreurs métier : `ORA-20001` solde insuffisant · `20002` compte non actif · `20003` montant invalide · `20004` compte introuvable · `20005` même compte · `20006` email déjà utilisé.

### Triggers

- `trg_accounts_audit` : chaque changement de solde, statut ou découvert est écrit dans `AUDIT_LOG` (ancien/nouveau, utilisateur, IP, date).
- `trg_transactions_immutable` : aucune transaction ne peut être modifiée ni supprimée.
- `trg_accounts_no_delete` : un compte se clôture (`status = 'CLOTURE'`), il ne se supprime pas.
- `trg_clients_normalize` : email en minuscules, sans espaces.

### Utilisateurs et privilèges

Créer un nouveau guichetier (en SYS, dans `XEPDB1`) :

```sql
CREATE USER guichet2 IDENTIFIED BY "MotDePasse_2026" PROFILE bank_profile;
GRANT CREATE SESSION TO guichet2;
GRANT role_teller TO guichet2;
```

Le profil `bank_profile` verrouille un compte 1 h après 5 échecs de connexion.

### Sauvegarde et restauration

```powershell
.\scripts\backup.ps1                              # crée backup\bankcore_AAAAMMJJ_HHMMSS.dmp
.\scripts\restore.ps1 bankcore_20261019_143000.dmp
```

`backup.ps1` fait un export Data Pump du schéma (`expdp`) et supprime les fichiers de plus de 14 jours. `restore.ps1` supprime le schéma, le réimporte (`impdp`, utilisateur, droits et données inclus) puis relance les tests pour prouver que la restauration est saine. Équivalents Bash : `scripts/backup.sh` et `scripts/restore.sh <fichier.dmp>`.

Ce sont des sauvegardes **logiques**. En production, on y ajouterait des sauvegardes physiques (RMAN) et l'archivage des journaux.

## API REST

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/accounts` | Liste des comptes |
| GET | `/api/accounts/<BJ…>/balance` | Solde courant (`bank_pkg.get_balance`) |
| GET | `/api/accounts/<BJ…>/statement` | 50 derniers mouvements |
| POST | `/api/accounts` | Ouvre un compte : `{"client_id": 1, "account_type": "COURANT" \| "EPARGNE", "overdraft_limit": 0, "initial_deposit": 0}` → `201 {"account_no": "BJ…"}` |
| GET | `/api/clients` | Clients et nombre de comptes (vue `v_client_summary`) |
| POST | `/api/clients` | Crée un client : `{"first_name", "last_name", "email", "phone"?}` → `201 {"client_id": 1}` |
| POST | `/api/deposit` · `/api/withdraw` | `{"account_no": "BJ…", "amount": 5000}` |
| POST | `/api/transfer` | `{"from": "BJ…", "to": "BJ…", "amount": 5000}` |
| GET | `/api/audit` | 100 dernières lignes d'audit (connexion `BANK_AUDITOR`) |

**Format des erreurs** : `{"error": "message en français", "code": "insufficient_funds", "params": {...}}`. Le champ `error` reste lisible tel quel ; `code` est stable et indépendant de la langue. Codes : `insufficient_funds`, `account_not_active`, `invalid_amount`, `account_not_found`, `same_account`, `duplicate_email`, `client_not_found`, `invalid_account_no`, `invalid_amount_format`, `required`, `too_long`, `invalid_money`, `invalid_email`, `invalid_phone`, `invalid_client`, `invalid_type`, `invalid_overdraft`, `invalid_data`, `bad_request` (route ou méthode inconnue), `internal_error`. Statuts HTTP : 400 (données), 404 (introuvable), 409 (règle métier), 500.

## Lancer le projet (version complète : Oracle XE + API)

### 1. Prérequis

- **Docker** (Docker Desktop sous Windows/macOS) et environ 2 Go de RAM libres pour Oracle XE ;
- **Python 3.10+** ;
- Sous Windows, si PowerShell refuse d'exécuter les scripts : `Set-ExecutionPolicy -Scope Process Bypass` (valable pour la session en cours seulement).

### 2. Configuration

`setup.*` crée `.env` à partir de `.env.example` au premier lancement. Les mots de passe par défaut sont **des mots de passe de démonstration** : changez-les dans `.env` **avant** le premier `setup` (ils sont fixés à la création des utilisateurs Oracle). `.env` est ignoré par Git.

| Variable | Rôle |
|---|---|
| `ORACLE_PASSWORD` | Mot de passe de `SYS` / `SYSTEM` |
| `BANK_OWNER_PASSWORD`, `BANK_APP_PASSWORD`, `BANK_AUDITOR_PASSWORD` | Mots de passe des trois utilisateurs du projet |
| `DB_DSN` | Adresse de la base pour l'API (défaut : `localhost:1521/XEPDB1`) |
| `API_HOST`, `API_PORT` | Écoute de l'API (défaut : `127.0.0.1` et `5000`) |

Le port Oracle (1521) n'est publié que sur `127.0.0.1`.

### 3. Démarrer

**Windows (PowerShell)**

```powershell
cd bankcore
.\scripts\setup.ps1                 # lance Oracle XE et déploie tout (1er démarrage : quelques minutes)
pip install -r api\requirements.txt
.\scripts\run_api.ps1               # http://127.0.0.1:5000
```

**Linux / macOS / Codespaces**

```bash
cd bankcore
bash scripts/setup.sh
pip install -r api/requirements.txt
bash scripts/run_api.sh              # http://127.0.0.1:5000
```

Relancer `setup.*` sur une base déjà déployée ne fait rien. Pour tout réinitialiser : `docker compose down -v`, puis relancer `setup.*`.

### Sans Docker en local : GitHub Codespaces

1. Publier le dépôt sur GitHub (le contenu de ce dossier à la racine), puis **Code → Codespaces → Create codespace** (le dossier `.devcontainer` installe Docker et Python).
2. Dans le terminal du Codespace : `bash scripts/setup.sh`, puis `bash scripts/run_api.sh`, et ouvrir le port 5000.

Oracle XE a besoin d'environ 2 Go de RAM : la machine 2 cœurs par défaut suffit. Arrêter le Codespace quand on ne s'en sert pas.

### Prévisualiser l'interface sans Oracle

```bash
cd api && pip install flask && python dev_mock.py     # http://127.0.0.1:5001
```

`dev_mock.py` expose les mêmes routes et les mêmes codes d'erreur avec des données fictives en mémoire. Il sert uniquement à voir et tester l'interface : la vraie logique reste dans `BANK_PKG`.

## Tests

```bash
bash scripts/setup.sh                              # exécute sql/07_tests.sql (11 contrôles sur la base)
cd api && pip install -r requirements-dev.txt && python -m pytest tests -q   # 36 tests, sans Oracle
```

`07_tests.sql` s'appuie sur le jeu de démonstration (`06_seed.sql`) et laisse quelques écritures neutres dans le journal : il est fait pour la base de démo, pas pour des données réelles. L'intégration continue (GitHub Actions, `.github/workflows/ci.yml`) rejoue les tests `pytest` à chaque `push`.

## Docker (pour le déploiement de la démo)

La démo en ligne n'utilise pas Oracle : `api/dev_mock.py` expose les mêmes routes avec des données fictives en mémoire, réinitialisées toutes les 30 minutes (`DEMO_RESET_MINUTES`) et plafonnées (40 clients, 80 comptes). Un bandeau « Démo » le signale dans l'interface. **La vraie logique métier (package, triggers, verrous, audit) n'existe que dans la version Oracle.**

```bash
docker build -t bankcore-demo .
docker run --rm -p 8080:8080 bankcore-demo        # http://127.0.0.1:8080
```

Pour déployer sur Render, Railway ou Fly.io, pointer vers ce `Dockerfile` : la plateforme fournit la variable `PORT`, prise en compte automatiquement. L'image tourne en utilisateur non-root et déclare un `HEALTHCHECK` sur `/healthz`.

**Sur Render** : *New → Web Service* → connecter le dépôt → *Language : Docker* → *Instance Type : Free* → *Health Check Path : `/healthz`*. Aucune variable n'est obligatoire.
Sur un plan gratuit, la première requête après une période d'inactivité peut prendre une trentaine de secondes (démarrage à froid), et les données de démo sont alors remises à zéro.

Le `Dockerfile` ne concerne que cette démo : la version complète (Oracle XE + API) se lance avec `docker-compose` et les scripts de `scripts/`.

## Limites assumées

- **Démo, pas production** : l'API n'a pas d'authentification et tourne sur le serveur de développement de Flask. Elle n'écoute que sur `127.0.0.1` par défaut ; ne l'exposez pas sur un réseau sans ajouter authentification, HTTPS et un serveur WSGI (gunicorn, waitress).
- Les mots de passe par défaut de `.env.example` sont publics : à changer.
- Les sauvegardes sont locales (`backup/`) et non chiffrées.
- Le script de restauration relance `07_tests.sql`, qui suppose les données de démonstration.
- La démo en ligne est une simulation en mémoire des règles métier ; elle ne prouve ni la concurrence, ni les verrous, ni les triggers Oracle.

## Pistes d'amélioration

- Authentification sur l'API et rôles distincts guichetier / auditeur côté interface.
- Blocage et clôture de compte via une procédure du package.
- Partitionnement de `TRANSACTIONS` par mois.
- `DBMS_SCHEDULER` pour des sauvegardes planifiées, et chiffrement des sauvegardes Data Pump.
- Oracle Unified Auditing.

## Auteur

**Yu-on AHINDE** — analyste informatique et programmeur · [GitHub](https://github.com/Yu-on0123) · [Dépôt du projet](https://github.com/Yu-on0123/bankcore)

## Licence

Code sous licence [MIT](LICENSE) © Yu-on AHINDE. Les polices de `api/static/fonts/` (Geist, Geist Mono) sont sous licence SIL OFL 1.1.
