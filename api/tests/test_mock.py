"""Tests du serveur de démonstration (dev_mock.py), sans Oracle. Lancer : cd api && python -m pytest tests -q"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pytest
import dev_mock as mock


@pytest.fixture
def c():
    mock.reset_state()
    return mock.app.test_client()


def test_meta_and_health(c):
    assert c.get("/api/meta").get_json()["demo"] is True
    assert c.get("/healthz").data == b"ok"


def test_deposit_withdraw_and_overdraft_refused(c):
    assert c.post("/api/deposit", json={"account_no": "BJ1000000003", "amount": 1000}).status_code == 200
    r = c.post("/api/withdraw", json={"account_no": "BJ1000000003", "amount": 10**8})
    assert r.status_code == 409 and r.get_json()["code"] == "insufficient_funds"


def test_transfer_rules(c):
    assert c.post("/api/transfer", json={"from": "BJ1000000001", "to": "BJ1000000001", "amount": 5}).get_json()["code"] == "same_account"
    assert c.post("/api/transfer", json={"from": "BJ1000000001", "to": "BJ1000000005", "amount": 5}).get_json()["code"] == "account_not_active"
    assert c.post("/api/transfer", json={"from": "BJ1000000001", "to": "BJ1000000002", "amount": 5000}).status_code == 200
    assert c.get("/api/accounts/BJ1000000002/balance").get_json()["balance"] == 105000


@pytest.mark.parametrize("path,body", [
    ("/api/deposit", {}), ("/api/deposit", {"account_no": "BJ1000000001"}), ("/api/deposit", {"account_no": "x", "amount": 5}),
    ("/api/deposit", {"account_no": "BJ1000000001", "amount": "1e30"}), ("/api/clients", {}), ("/api/accounts", {}),
])
def test_bad_input_is_400_not_500(c, path, body):
    assert c.post(path, json=body).status_code == 400


def test_client_and_account_flow_and_duplicate(c):
    r = c.post("/api/clients", json={"first_name": "Yao", "last_name": "D", "email": "NEW@Example.com"})
    assert r.status_code == 201
    cid = r.get_json()["client_id"]
    assert c.post("/api/clients", json={"first_name": "Y", "last_name": "D", "email": "new@example.com"}).get_json()["code"] == "duplicate_email"
    r = c.post("/api/accounts", json={"client_id": cid, "account_type": "epargne", "overdraft_limit": 500, "initial_deposit": "2500.50"})
    no = r.get_json()["account_no"]
    acc = {a["account_no"]: a for a in c.get("/api/accounts").get_json()}[no]
    assert acc["overdraft_limit"] == 0 and acc["balance"] == 2500.5
    assert c.post("/api/accounts", json={"client_id": 999}).status_code == 404


def test_periodic_reset(c):
    c.post("/api/deposit", json={"account_no": "BJ1000000001", "amount": 1})
    mock._started -= mock.RESET_SECONDS + 1
    assert c.get("/api/accounts/BJ1000000001/balance").get_json()["balance"] == 245000


def test_demo_caps(c):
    for i in range(mock.MAX_CLIENTS):
        c.post("/api/clients", json={"first_name": "A", "last_name": "B", "email": f"u{i}@x.co"})
    assert c.post("/api/clients", json={"first_name": "A", "last_name": "B", "email": "last@x.co"}).status_code == 409
