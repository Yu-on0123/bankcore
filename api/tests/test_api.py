"""Tests de la couche HTTP sans base Oracle (pool simulé). Lancer : cd api && python -m pytest tests -q"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import oracledb
import pytest
import app as api


class FakeVar:
    def __init__(self): self.v = None
    def getvalue(self): return self.v


class FakeCursor:
    def __init__(self, log, fail=None):
        self.log, self.fail, self.description, self._rows = log, fail, None, []
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def _maybe_fail(self):
        if self.fail: raise self.fail
    def var(self, _t): return FakeVar()
    def callproc(self, name, args):
        self._maybe_fail(); self.log.append((name, args))
        if name.endswith("create_client"): args[-1].v = 42
    def callfunc(self, name, _t, args):
        self._maybe_fail(); self.log.append((name, args))
        return "BJ1000000009" if name.endswith("open_account") else 1500
    def execute(self, sql):
        self.log.append(("sql", sql))
        self.description = [("CLIENT_ID",), ("FULL_NAME",)]
        self._rows = [(1, "Aminatou Sagbo")]
    def __iter__(self): return iter(self._rows)


class FakePool:
    def __init__(self, fail=None): self.log, self.fail = [], fail
    def acquire(self):
        pool = self
        class C:
            def __enter__(s): return s
            def __exit__(s, *a): return False
            def cursor(s): return FakeCursor(pool.log, pool.fail)
        return C()


def db_error(code, message):
    class E:  # imite oracledb._Error
        pass
    e = E(); e.code, e.message = code, message
    return oracledb.DatabaseError(e)


@pytest.fixture
def client(monkeypatch):
    pool = FakePool()
    monkeypatch.setattr(api, "app_pool", lambda: pool)
    c = api.app.test_client(); c.pool = pool
    return c


def test_create_client_ok(client):
    r = client.post("/api/clients", json={"first_name": " Yao ", "last_name": "Dossou", "email": "Yao@Example.com", "phone": "+229 97 00 00 10"})
    assert r.status_code == 201 and r.get_json() == {"ok": True, "client_id": 42}
    assert client.pool.log[0] == ("bank_owner.bank_pkg.create_client", ["Yao", "Dossou", "yao@example.com", "+229 97 00 00 10", client.pool.log[0][1][-1]])


@pytest.mark.parametrize("body,msg", [
    ({"last_name": "D", "email": "a@b.co"}, "Prénom obligatoire"),
    ({"first_name": "Y", "last_name": "D", "email": "pas-un-email"}, "Adresse email invalide"),
    ({"first_name": "Y", "last_name": "D", "email": "a@b.co", "phone": "abc"}, "Téléphone invalide"),
    ({"first_name": "Y" * 61, "last_name": "D", "email": "a@b.co"}, "trop long"),
])
def test_create_client_validation(client, body, msg):
    r = client.post("/api/clients", json=body)
    assert r.status_code == 400 and msg in r.get_json()["error"]
    assert r.get_json()["code"] in {"required", "invalid_email", "invalid_phone", "too_long"}
    assert client.pool.log == []


def test_duplicate_email_maps_to_409(monkeypatch):
    monkeypatch.setattr(api, "app_pool", lambda: FakePool(db_error(20006, "ORA-20006: Un client avec cet email existe déjà\nORA-06512")))
    r = api.app.test_client().post("/api/clients", json={"first_name": "A", "last_name": "B", "email": "a@b.co"})
    assert r.status_code == 409 and r.get_json()["error"] == "Un client avec cet email existe déjà"
    assert r.get_json()["code"] == "duplicate_email"


def test_open_account_ok(client):
    r = client.post("/api/accounts", json={"client_id": 3, "account_type": "epargne", "overdraft_limit": 0, "initial_deposit": "25000.50"})
    assert r.status_code == 201 and r.get_json()["account_no"] == "BJ1000000009"
    name, args = client.pool.log[0]
    assert name == "bank_owner.bank_pkg.open_account" and args[:2] == [3, "EPARGNE"] and str(args[3]) == "25000.50"


def test_open_account_defaults(client):
    r = client.post("/api/accounts", json={"client_id": "7"})
    assert r.status_code == 201 and client.pool.log[0][1][1] == "COURANT"


@pytest.mark.parametrize("body", [
    {}, {"client_id": "x"}, {"client_id": 0}, {"client_id": 1, "account_type": "PRO"},
    {"client_id": 1, "overdraft_limit": -5}, {"client_id": 1, "initial_deposit": "1.234"}, {"client_id": 1, "initial_deposit": "abc"},
])
def test_open_account_validation(client, body):
    assert client.post("/api/accounts", json=body).status_code == 400
    assert client.pool.log == []


def test_unknown_client_maps_to_404(monkeypatch):
    monkeypatch.setattr(api, "app_pool", lambda: FakePool(db_error(2291, "ORA-02291: integrity constraint (BANK_OWNER.FK_ACCOUNTS_CLIENT) violated - parent key not found")))
    r = api.app.test_client().post("/api/accounts", json={"client_id": 999})
    assert r.status_code == 404 and r.get_json()["error"] == "Client introuvable" and r.get_json()["code"] == "client_not_found"


def test_check_constraint_maps_to_400(monkeypatch):
    monkeypatch.setattr(api, "app_pool", lambda: FakePool(db_error(2290, "ORA-02290: check constraint (BANK_OWNER.CK_CLIENTS_EMAIL) violated")))
    r = api.app.test_client().post("/api/clients", json={"first_name": "A", "last_name": "B", "email": "a@b.co"})
    assert r.status_code == 400 and r.get_json()["error"] == "Adresse email invalide" and r.get_json()["code"] == "invalid_email"


def test_list_clients_and_balance(client):
    assert client.get("/api/clients").get_json() == [{"client_id": 1, "full_name": "Aminatou Sagbo"}]
    assert client.get("/api/accounts/BJ1000000001/balance").get_json() == {"account_no": "BJ1000000001", "balance": 1500}
    assert client.get("/api/accounts/XX/balance").status_code == 400


def test_business_error_carries_code_and_account_param(monkeypatch):
    monkeypatch.setattr(api, "app_pool", lambda: FakePool(db_error(20004, "ORA-20004: Compte introuvable : BJ1000000042\nORA-06512: ligne 3")))
    r = api.app.test_client().post("/api/deposit", json={"account_no": "BJ1000000042", "amount": 100})
    assert r.status_code == 404
    assert r.get_json() == {"error": "Compte introuvable : BJ1000000042", "code": "account_not_found", "params": {"account_no": "BJ1000000042"}}


def test_validation_error_has_field_param(client):
    r = client.post("/api/clients", json={"first_name": "", "last_name": "D", "email": "a@b.co"})
    assert r.get_json()["code"] == "required" and r.get_json()["params"] == {"field": "first_name"}
    r = client.post("/api/accounts", json={"client_id": 1, "initial_deposit": "-1"})
    assert r.get_json()["code"] == "invalid_money" and r.get_json()["params"] == {"field": "initial_deposit"}


def test_amount_too_large_rejected(client):
    r = client.post("/api/deposit", json={"account_no": "BJ1000000001", "amount": "1e20"})
    assert r.status_code == 400 and r.get_json()["code"] == "invalid_amount_format"
    assert client.pool.log == []


def test_unknown_api_route_returns_json(client):
    r = client.get("/api/nope")
    assert r.status_code == 404 and r.get_json()["code"] == "bad_request"


def test_unexpected_error_returns_json_500(monkeypatch):
    monkeypatch.setattr(api, "app_pool", lambda: FakePool(RuntimeError("boom")))
    api.app.config["PROPAGATE_EXCEPTIONS"] = False
    r = api.app.test_client().post("/api/deposit", json={"account_no": "BJ1000000001", "amount": 10})
    assert r.status_code == 500 and r.get_json()["code"] == "internal_error"


def test_missing_password_is_explicit(monkeypatch):
    monkeypatch.delenv("BANK_APP_PASSWORD", raising=False)
    monkeypatch.setattr(api, "_pools", {})
    with pytest.raises(RuntimeError, match="BANK_APP_PASSWORD"):
        api.app_pool()
