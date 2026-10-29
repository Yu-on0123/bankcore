"""BankCore API : fine couche HTTP au-dessus du package PL/SQL BANK_OWNER.BANK_PKG.

Toute la logique métier (règles, verrous, journal) vit dans la base. Cette API :
  - se connecte avec BANK_APP (rôle guichetier : EXECUTE sur le package, aucun accès aux tables),
  - utilise BANK_AUDITOR (lecture seule) uniquement pour le journal d'audit.
"""
import os
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

import oracledb
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

DSN = os.getenv("DB_DSN", "localhost:1521/XEPDB1")
HOST = os.getenv("API_HOST", "127.0.0.1")  # l'API n'a pas d'authentification : ne l'exposer que sur la machine locale
PORT = int(os.getenv("API_PORT", "5000"))
ACCOUNT_RE = re.compile(r"^BJ\d{10}$")

app = Flask(__name__, static_folder="static")
_pools = {}

# Code d'erreur ORA-200xx -> statut HTTP
ORA_TO_HTTP = {20001: 409, 20002: 409, 20003: 400, 20004: 404, 20005: 400, 20006: 409}
# Code d'erreur stable (indépendant de la langue) renvoyé dans le champ "code" : l'interface le traduit (FR/EN)
ORA_TO_CODE = {20001: "insufficient_funds", 20002: "account_not_active", 20003: "invalid_amount",
               20004: "account_not_found", 20005: "same_account", 20006: "duplicate_email"}
# Erreurs d'intégrité Oracle remontées par les contraintes CHECK : (message FR, code)
CHECK_ERRORS = {
    "CK_CLIENTS_EMAIL": ("Adresse email invalide", "invalid_email"),
    "CK_ACCOUNTS_TYPE": ("Type de compte invalide (COURANT ou EPARGNE)", "invalid_type"),
    "CK_ACCOUNTS_OVERDR": ("Le découvert autorisé ne peut pas être négatif", "invalid_overdraft"),
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+()\-. ]{6,30}$")
MAX_AMOUNT = Decimal("9999999999999.99")  # NUMBER(15,2)


class ApiError(Exception):
    """Erreur HTTP : `message` (français, rétrocompatible) + `code` stable + `params` pour la traduction côté client."""

    def __init__(self, message, status=400, code="bad_request", params=None):
        super().__init__(message)
        self.message, self.status, self.code, self.params = message, status, code, params or {}


def get_pool(user, password_env):
    if user not in _pools:
        password = os.environ.get(password_env)
        if not password:
            raise RuntimeError(f"Variable d'environnement {password_env} absente (voir .env.example, ou lancer scripts/run_api.*)")
        _pools[user] = oracledb.create_pool(user=user, password=password, dsn=DSN, min=1, max=4, increment=1)
    return _pools[user]


def app_pool():
    return get_pool("bank_app", "BANK_APP_PASSWORD")


def audit_pool():
    return get_pool("bank_auditor", "BANK_AUDITOR_PASSWORD")


def clean(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat(timespec="seconds")
    return value


def rows(cursor):
    columns = [d[0].lower() for d in cursor.description]
    return [dict(zip(columns, map(clean, r))) for r in cursor]


def account_no(value):
    value = str(value or "").strip().upper()
    if not ACCOUNT_RE.match(value):
        raise ApiError("Numéro de compte invalide (format attendu : BJ + 10 chiffres)", code="invalid_account_no")
    return value


def amount(data):
    try:
        value = Decimal(str(data.get("amount")))
    except InvalidOperation:
        raise ApiError("Montant invalide", code="invalid_amount_format")
    if not value.is_finite() or abs(value) > MAX_AMOUNT:
        raise ApiError("Montant invalide", code="invalid_amount_format")
    return value


def text(data, key, label, max_len):
    value = " ".join(str(data.get(key) or "").split())
    if not value:
        raise ApiError(f"{label} obligatoire", code="required", params={"field": key})
    if len(value) > max_len:
        raise ApiError(f"{label} trop long ({max_len} caractères maximum)", code="too_long", params={"field": key, "max": max_len})
    return value


def money_field(data, key, label):
    """Montant >= 0 facultatif (0 par défaut), 2 décimales maximum."""
    raw = data.get(key)
    if raw in (None, ""):
        return Decimal(0)
    try:
        value = Decimal(str(raw))
    except InvalidOperation:
        raise ApiError(f"{label} invalide", code="invalid_money", params={"field": key})
    if not value.is_finite() or value < 0 or value > MAX_AMOUNT or value != value.quantize(Decimal("0.01")):
        raise ApiError(f"{label} invalide (positif, 2 décimales maximum)", code="invalid_money", params={"field": key})
    return value


def call(procedure, *args):
    with app_pool().acquire() as conn, conn.cursor() as cur:
        cur.callproc(f"bank_owner.bank_pkg.{procedure}", list(args))


@app.errorhandler(ApiError)
def handle_api_error(e):
    return jsonify(error=e.message, code=e.code, params=e.params), e.status


@app.errorhandler(oracledb.DatabaseError)
def handle_db_error(e):
    err = e.args[0] if e.args else e
    code = getattr(err, "code", 0)
    err_message = str(getattr(err, "message", err))
    if code == 2291:  # clé étrangère : le client n'existe pas
        return jsonify(error="Client introuvable", code="client_not_found", params={}), 404
    if code == 2290:  # contrainte CHECK
        match = re.search(r"\.(\w+)\)", err_message)
        name = match.group(1).upper() if match else ""
        message, check_code = CHECK_ERRORS.get(name, ("Données invalides", "invalid_data"))
        return jsonify(error=message, code=check_code, params={}), 400
    if code in ORA_TO_HTTP:
        message = re.sub(r"^ORA-\d+:\s*", "", err_message.splitlines()[0])
        found = re.search(r"BJ\d{10}", message)
        params = {"account_no": found.group(0)} if found else {}
        return jsonify(error=message, code=ORA_TO_CODE[code], params=params), ORA_TO_HTTP[code]
    app.logger.exception("Erreur base de données")
    return jsonify(error="Erreur interne de la base de données", code="internal_error", params={}), 500


@app.errorhandler(HTTPException)
def handle_http_error(e):
    """Erreurs HTTP de Flask (404, 405...) : JSON pour l'API, page standard sinon."""
    if request.path.startswith("/api/"):
        return jsonify(error=e.description, code="bad_request", params={}), e.code
    return e


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    app.logger.exception("Erreur inattendue")
    return jsonify(error="Erreur interne", code="internal_error", params={}), 500


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/accounts")
def list_accounts():
    with app_pool().acquire() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT account_no, client_name, email, account_type, balance, overdraft_limit, status "
            "FROM bank_owner.v_account_summary ORDER BY account_no"
        )
        return jsonify(rows(cur))


@app.get("/api/accounts/<number>/balance")
def balance(number):
    number = account_no(number)
    with app_pool().acquire() as conn, conn.cursor() as cur:
        value = cur.callfunc("bank_owner.bank_pkg.get_balance", oracledb.DB_TYPE_NUMBER, [number])
        return jsonify(account_no=number, balance=clean(value))


@app.post("/api/accounts")
def open_account():
    """Ouvre un compte : {client_id, account_type?, overdraft_limit?, initial_deposit?}."""
    data = request.get_json(silent=True) or {}
    try:
        client_id = int(data.get("client_id"))
    except (TypeError, ValueError):
        raise ApiError("Client invalide", code="invalid_client")
    if client_id <= 0:
        raise ApiError("Client invalide", code="invalid_client")
    kind = str(data.get("account_type") or "COURANT").strip().upper()
    if kind not in ("COURANT", "EPARGNE"):
        raise ApiError("Type de compte invalide (COURANT ou EPARGNE)", code="invalid_type")
    overdraft = money_field(data, "overdraft_limit", "Découvert")
    initial = money_field(data, "initial_deposit", "Dépôt initial")
    with app_pool().acquire() as conn, conn.cursor() as cur:
        number = cur.callfunc("bank_owner.bank_pkg.open_account", str, [client_id, kind, overdraft, initial])
    return jsonify(ok=True, account_no=number), 201


@app.get("/api/clients")
def list_clients():
    with app_pool().acquire() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT client_id, first_name, last_name, full_name, email, phone, created_at, account_count "
            "FROM bank_owner.v_client_summary ORDER BY client_id"
        )
        return jsonify(rows(cur))


@app.post("/api/clients")
def create_client():
    """Crée un client : {first_name, last_name, email, phone?}."""
    data = request.get_json(silent=True) or {}
    first = text(data, "first_name", "Prénom", 60)
    last = text(data, "last_name", "Nom", 60)
    email = text(data, "email", "Email", 120).lower()
    if not EMAIL_RE.match(email):
        raise ApiError("Adresse email invalide", code="invalid_email")
    phone = " ".join(str(data.get("phone") or "").split()) or None
    if phone and not PHONE_RE.match(phone):
        raise ApiError("Téléphone invalide (chiffres, +, espaces ; 6 à 30 caractères)", code="invalid_phone")
    with app_pool().acquire() as conn, conn.cursor() as cur:
        out = cur.var(oracledb.DB_TYPE_NUMBER)
        cur.callproc("bank_owner.bank_pkg.create_client", [first, last, email, phone, out])
        client_id = int(out.getvalue())
    return jsonify(ok=True, client_id=client_id), 201


@app.get("/api/accounts/<number>/statement")
def statement(number):
    number = account_no(number)
    with app_pool().acquire() as conn, conn.cursor() as cur:
        ref = cur.callfunc("bank_owner.bank_pkg.statement", oracledb.DB_TYPE_CURSOR, [number, 50])
        return jsonify(rows(ref))


@app.post("/api/deposit")
def deposit():
    data = request.get_json(silent=True) or {}
    call("deposit", account_no(data.get("account_no")), amount(data))
    return jsonify(ok=True)


@app.post("/api/withdraw")
def withdraw():
    data = request.get_json(silent=True) or {}
    call("withdraw", account_no(data.get("account_no")), amount(data))
    return jsonify(ok=True)


@app.post("/api/transfer")
def transfer():
    data = request.get_json(silent=True) or {}
    call("transfer", account_no(data.get("from")), account_no(data.get("to")), amount(data))
    return jsonify(ok=True)


@app.get("/api/audit")
def audit():
    with audit_pool().acquire() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM bank_owner.v_audit_recent")
        return jsonify(rows(cur))


if __name__ == "__main__":
    for var in ("BANK_APP_PASSWORD", "BANK_AUDITOR_PASSWORD"):
        if not os.environ.get(var):
            raise SystemExit(f"{var} n'est pas défini. Lancez l'API avec scripts/run_api.sh (ou .ps1), qui charge le fichier .env.")
    app.run(host=HOST, port=PORT)
