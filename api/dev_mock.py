"""Serveur de démonstration SANS Oracle : mêmes routes et mêmes codes d'erreur que app.py, données en mémoire.

Usage local : pip install flask && python dev_mock.py  ->  http://127.0.0.1:5001
Démo en ligne : gunicorn dev_mock:app (voir Dockerfile). Variables : PORT, API_HOST, DEMO_RESET_MINUTES.

Sert uniquement à prévisualiser/tester l'interface ; la logique réelle reste dans BANK_PKG.
Les données sont partagées entre visiteurs et remises à zéro toutes les DEMO_RESET_MINUTES minutes (30 par défaut).
"""
import copy
import os
import re
import threading
import time
from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

app = Flask(__name__, static_folder="static")

RESET_SECONDS = max(1, int(os.getenv("DEMO_RESET_MINUTES", "30"))) * 60
MAX_CLIENTS, MAX_ACCOUNTS, MAX_ROWS = 40, 80, 500   # garde-fous : démo publique
ACCOUNT_RE = re.compile(r"^BJ\d{10}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+()\-. ]{6,30}$")
MAX_AMOUNT = Decimal("9999999999999.99")

SEED_ACCOUNTS = {
    "BJ1000000001": dict(client_name="Aminatou Sagbo", email="a@example.com", account_type="COURANT", balance=245000, overdraft_limit=500000, status="ACTIF"),
    "BJ1000000002": dict(client_name="Aminatou Sagbo", email="a@example.com", account_type="EPARGNE", balance=100000, overdraft_limit=0, status="ACTIF"),
    "BJ1000000003": dict(client_name="Koffi Adjovi", email="k@example.com", account_type="COURANT", balance=50000, overdraft_limit=250000, status="ACTIF"),
    "BJ1000000004": dict(client_name="Fatoumata Bio", email="f@example.com", account_type="COURANT", balance=-60000, overdraft_limit=150000, status="ACTIF"),
    "BJ1000000005": dict(client_name="Yao Dossou", email="y@example.com", account_type="COURANT", balance=12000, overdraft_limit=0, status="BLOQUE"),
}
SEED_CLIENTS = {
    1: dict(first_name="Aminatou", last_name="Sagbo", email="a@example.com", phone="+22997000001"),
    2: dict(first_name="Koffi", last_name="Adjovi", email="k@example.com", phone="+22997000002"),
    3: dict(first_name="Fatoumata", last_name="Bio", email="f@example.com", phone=None),
    4: dict(first_name="Yao", last_name="Dossou", email="y@example.com", phone=None),
}
SEED_OWNER = {"BJ1000000001": 1, "BJ1000000002": 1, "BJ1000000003": 2, "BJ1000000004": 3, "BJ1000000005": 4}

_lock = threading.RLock()
A, CL, OWNER, TX, AUDIT = {}, {}, {}, {}, []
_started = 0.0
_next_no = 0


def reset_state():
    global A, CL, OWNER, TX, AUDIT, _started, _next_no
    A, CL, OWNER = copy.deepcopy(SEED_ACCOUNTS), copy.deepcopy(SEED_CLIENTS), dict(SEED_OWNER)
    TX, AUDIT = {k: [] for k in A}, []
    _next_no = 1000000001 + len(A)
    _started = time.monotonic()


reset_state()


class ApiError(Exception):
    def __init__(self, message, status=400, code="bad_request", **params):
        super().__init__(message)
        self.message, self.status, self.code, self.params = message, status, code, params


@app.errorhandler(ApiError)
def handle_api_error(e):
    return jsonify(error=e.message, code=e.code, params=e.params), e.status


@app.errorhandler(HTTPException)
def handle_http_error(e):
    if request.path.startswith("/api/"):
        return jsonify(error=e.description, code="bad_request", params={}), e.code
    return e


@app.errorhandler(Exception)
def handle_unexpected(e):
    app.logger.exception("Erreur inattendue")
    return jsonify(error="Erreur interne", code="internal_error", params={}), 500


@app.before_request
def periodic_reset():
    with _lock:
        if time.monotonic() - _started > RESET_SECONDS:
            reset_state()


now = lambda: datetime.now().isoformat(timespec="seconds")


# ---------- Validation (mêmes règles et mêmes codes que app.py) ----------
def body():
    return request.get_json(silent=True) or {}


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
    return value.quantize(Decimal("0.01"))


def text(data, key, label, max_len):
    value = " ".join(str(data.get(key) or "").split())
    if not value:
        raise ApiError(f"{label} obligatoire", code="required", field=key)
    if len(value) > max_len:
        raise ApiError(f"{label} trop long ({max_len} caractères maximum)", code="too_long", field=key, max=max_len)
    return value


def money_field(data, key, label):
    raw = data.get(key)
    if raw in (None, ""):
        return Decimal(0)
    try:
        value = Decimal(str(raw))
    except InvalidOperation:
        raise ApiError(f"{label} invalide", code="invalid_money", field=key)
    if not value.is_finite() or value < 0 or value > MAX_AMOUNT or value != value.quantize(Decimal("0.01")):
        raise ApiError(f"{label} invalide (positif, 2 décimales maximum)", code="invalid_money", field=key)
    return value


# ---------- Règles métier simulées ----------
def log(no, typ, amt, cp=None):
    amt = float(amt)
    TX[no].insert(0, dict(tx_id=len(TX[no]) + 1, tx_date=now(), tx_type=typ, counterpart=cp, amount=amt, balance_after=A[no]["balance"]))
    del TX[no][MAX_ROWS:]
    before = A[no]["balance"] - (amt if typ in ("DEPOT", "VIREMENT_CREDIT") else -amt)
    fmt = lambda b: ("balance=%g;status=%s;overdraft=%g" % (b, A[no]["status"], A[no]["overdraft_limit"]))
    AUDIT.insert(0, dict(audit_id=len(AUDIT) + 1, changed_at=now(), db_user="BANK_APP", client_ip="127.0.0.1", table_name="ACCOUNTS",
                         operation="UPDATE", record_id=no, old_value=fmt(before), new_value=fmt(A[no]["balance"])))
    del AUDIT[MAX_ROWS:]


def check(no, amt):
    if amt <= 0:
        raise ApiError("Montant invalide : il doit être strictement positif", code="invalid_amount")
    if no not in A:
        raise ApiError("Compte introuvable : " + no, 404, "account_not_found", account_no=no)
    if A[no]["status"] != "ACTIF":
        raise ApiError("Compte non actif : " + no, 409, "account_not_active", account_no=no)


def require_funds(no, amt):
    if float(A[no]["balance"]) - float(amt) < -A[no]["overdraft_limit"]:
        raise ApiError("Solde insuffisant sur le compte " + no, 409, "insufficient_funds", account_no=no)


# ---------- Routes ----------
@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.get("/healthz")
def healthz():
    return "ok"


@app.get("/api/meta")
def meta():
    return jsonify(demo=True, reset_minutes=RESET_SECONDS // 60)


@app.get("/api/accounts")
def accounts():
    return jsonify([dict(account_no=k, **v) for k, v in sorted(A.items())])


@app.get("/api/accounts/<number>/balance")
def bal(number):
    no = account_no(number)
    if no not in A:
        raise ApiError("Compte introuvable : " + no, 404, "account_not_found", account_no=no)
    return jsonify(account_no=no, balance=A[no]["balance"])


@app.get("/api/accounts/<number>/statement")
def statement(number):
    no = account_no(number)
    if no not in A:
        raise ApiError("Compte introuvable : " + no, 404, "account_not_found", account_no=no)
    return jsonify(TX[no][:50])


@app.post("/api/deposit")
def deposit():
    with _lock:
        d = body(); no, amt = account_no(d.get("account_no")), amount(d)
        check(no, amt)
        A[no]["balance"] = float(A[no]["balance"]) + float(amt); log(no, "DEPOT", amt)
    return jsonify(ok=True)


@app.post("/api/withdraw")
def withdraw():
    with _lock:
        d = body(); no, amt = account_no(d.get("account_no")), amount(d)
        check(no, amt); require_funds(no, amt)
        A[no]["balance"] = float(A[no]["balance"]) - float(amt); log(no, "RETRAIT", amt)
    return jsonify(ok=True)


@app.post("/api/transfer")
def transfer():
    with _lock:
        d = body(); s, t, amt = account_no(d.get("from")), account_no(d.get("to")), amount(d)
        if amt <= 0:
            raise ApiError("Montant invalide : il doit être strictement positif", code="invalid_amount")
        if s == t:
            raise ApiError("Le compte source et le compte destination sont identiques", code="same_account")
        for n in (s, t):
            check(n, amt)
        require_funds(s, amt)
        A[s]["balance"] = float(A[s]["balance"]) - float(amt); A[t]["balance"] = float(A[t]["balance"]) + float(amt)
        log(s, "VIREMENT_DEBIT", amt, t); log(t, "VIREMENT_CREDIT", amt, s)
    return jsonify(ok=True)


@app.get("/api/clients")
def clients():
    return jsonify([dict(client_id=i, full_name=c["first_name"] + " " + c["last_name"], created_at=now(),
                         account_count=sum(1 for n in OWNER.values() if n == i), **c) for i, c in CL.items()])


@app.post("/api/clients")
def new_client():
    with _lock:
        d = body()
        first, last = text(d, "first_name", "Prénom", 60), text(d, "last_name", "Nom", 60)
        email = text(d, "email", "Email", 120).lower()
        if not EMAIL_RE.match(email):
            raise ApiError("Adresse email invalide", code="invalid_email")
        phone = " ".join(str(d.get("phone") or "").split()) or None
        if phone and not PHONE_RE.match(phone):
            raise ApiError("Téléphone invalide (chiffres, +, espaces ; 6 à 30 caractères)", code="invalid_phone")
        if any(c["email"] == email for c in CL.values()):
            raise ApiError("Un client avec cet email existe déjà", 409, "duplicate_email")
        if len(CL) >= MAX_CLIENTS:
            raise ApiError("Limite de la démo atteinte (les données sont réinitialisées régulièrement)", 409, "invalid_data")
        i = max(CL) + 1
        CL[i] = dict(first_name=first, last_name=last, email=email, phone=phone)
    return jsonify(ok=True, client_id=i), 201


@app.post("/api/accounts")
def new_account():
    global _next_no
    with _lock:
        d = body()
        try:
            cid = int(d.get("client_id"))
        except (TypeError, ValueError):
            raise ApiError("Client invalide", code="invalid_client")
        if cid <= 0:
            raise ApiError("Client invalide", code="invalid_client")
        typ = str(d.get("account_type") or "COURANT").strip().upper()
        if typ not in ("COURANT", "EPARGNE"):
            raise ApiError("Type de compte invalide (COURANT ou EPARGNE)", code="invalid_type")
        overdraft, initial = money_field(d, "overdraft_limit", "Découvert"), money_field(d, "initial_deposit", "Dépôt initial")
        if cid not in CL:
            raise ApiError("Client introuvable", 404, "client_not_found")
        if len(A) >= MAX_ACCOUNTS:
            raise ApiError("Limite de la démo atteinte (les données sont réinitialisées régulièrement)", 409, "invalid_data")
        no = "BJ%d" % _next_no; _next_no += 1
        c = CL[cid]
        A[no] = dict(client_name=c["first_name"] + " " + c["last_name"], email=c["email"], account_type=typ, balance=float(initial),
                     overdraft_limit=0 if typ == "EPARGNE" else float(overdraft), status="ACTIF")
        OWNER[no] = cid; TX[no] = []
        if initial > 0:
            log(no, "DEPOT", initial)
    return jsonify(ok=True, account_no=no), 201


@app.get("/api/audit")
def audit():
    return jsonify(AUDIT[:100])


if __name__ == "__main__":
    app.run(host=os.getenv("API_HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5001")))
