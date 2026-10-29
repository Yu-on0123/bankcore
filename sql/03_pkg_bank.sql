-- 03_pkg_bank.sql — package métier, seul point d'entrée pour modifier les données
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF

CREATE OR REPLACE PACKAGE bank_pkg AS
  -- Exceptions métier (codes -20001 à -20006)
  e_insufficient_funds EXCEPTION;
  e_account_not_active EXCEPTION;
  e_invalid_amount     EXCEPTION;
  e_account_not_found  EXCEPTION;
  e_same_account       EXCEPTION;
  e_duplicate_email    EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_insufficient_funds, -20001);
  PRAGMA EXCEPTION_INIT(e_account_not_active, -20002);
  PRAGMA EXCEPTION_INIT(e_invalid_amount,     -20003);
  PRAGMA EXCEPTION_INIT(e_account_not_found,  -20004);
  PRAGMA EXCEPTION_INIT(e_same_account,       -20005);
  PRAGMA EXCEPTION_INIT(e_duplicate_email,    -20006);

  PROCEDURE create_client(
    p_first_name IN VARCHAR2,
    p_last_name  IN VARCHAR2,
    p_email      IN VARCHAR2,
    p_phone      IN VARCHAR2,
    p_client_id  OUT NUMBER);

  FUNCTION open_account(
    p_client_id       IN NUMBER,
    p_type            IN VARCHAR2 DEFAULT 'COURANT',
    p_overdraft       IN NUMBER   DEFAULT 0,
    p_initial_deposit IN NUMBER   DEFAULT 0) RETURN VARCHAR2;

  PROCEDURE deposit (p_account_no IN VARCHAR2, p_amount IN NUMBER);
  PROCEDURE withdraw(p_account_no IN VARCHAR2, p_amount IN NUMBER);
  PROCEDURE transfer(p_from_account IN VARCHAR2, p_to_account IN VARCHAR2, p_amount IN NUMBER);

  FUNCTION get_balance(p_account_no IN VARCHAR2) RETURN NUMBER;
  FUNCTION statement  (p_account_no IN VARCHAR2, p_limit IN NUMBER DEFAULT 50) RETURN SYS_REFCURSOR;
END bank_pkg;
/

CREATE OR REPLACE PACKAGE BODY bank_pkg AS

  -- ---------- Sous-programmes privés ----------

  PROCEDURE check_amount(p_amount IN NUMBER) IS
  BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE_APPLICATION_ERROR(-20003, 'Montant invalide : il doit être strictement positif');
    END IF;
  END check_amount;

  -- Verrouille la ligne du compte (SELECT ... FOR UPDATE) pour éviter les mises à jour concurrentes
  FUNCTION lock_account(p_account_no IN VARCHAR2) RETURN accounts%ROWTYPE IS
    v_acc accounts%ROWTYPE;
  BEGIN
    SELECT * INTO v_acc FROM accounts WHERE account_no = p_account_no FOR UPDATE;
    RETURN v_acc;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20004, 'Compte introuvable : ' || p_account_no);
  END lock_account;

  PROCEDURE require_active(p_acc IN accounts%ROWTYPE) IS
  BEGIN
    IF p_acc.status <> 'ACTIF' THEN
      RAISE_APPLICATION_ERROR(-20002, 'Compte ' || p_acc.account_no || ' non actif (' || p_acc.status || ')');
    END IF;
  END require_active;

  PROCEDURE log_tx(
    p_account_id IN NUMBER,
    p_type       IN VARCHAR2,
    p_amount     IN NUMBER,
    p_balance    IN NUMBER,
    p_related_id IN NUMBER) IS
  BEGIN
    INSERT INTO transactions (account_id, tx_type, amount, balance_after, related_account_id)
    VALUES (p_account_id, p_type, p_amount, p_balance, p_related_id);
  END log_tx;

  -- ---------- API publique ----------

  PROCEDURE create_client(
    p_first_name IN VARCHAR2,
    p_last_name  IN VARCHAR2,
    p_email      IN VARCHAR2,
    p_phone      IN VARCHAR2,
    p_client_id  OUT NUMBER) IS
  BEGIN
    INSERT INTO clients (first_name, last_name, email, phone)
    VALUES (TRIM(p_first_name), TRIM(p_last_name), p_email, p_phone)
    RETURNING client_id INTO p_client_id;
    COMMIT;
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20006, 'Un client avec cet email existe déjà');
  END create_client;

  FUNCTION open_account(
    p_client_id       IN NUMBER,
    p_type            IN VARCHAR2 DEFAULT 'COURANT',
    p_overdraft       IN NUMBER   DEFAULT 0,
    p_initial_deposit IN NUMBER   DEFAULT 0) RETURN VARCHAR2 IS
    v_no        accounts.account_no%TYPE;
    v_id        accounts.account_id%TYPE;
    v_type      VARCHAR2(10) := UPPER(p_type);
    -- un compte épargne n'a jamais de découvert
    v_overdraft NUMBER := CASE WHEN UPPER(p_type) = 'EPARGNE' THEN 0 ELSE NVL(p_overdraft, 0) END;
    v_initial   NUMBER := ROUND(NVL(p_initial_deposit, 0), 2);
  BEGIN
    v_no := 'BJ' || TO_CHAR(seq_account_no.NEXTVAL);

    INSERT INTO accounts (account_no, client_id, account_type, overdraft_limit)
    VALUES (v_no, p_client_id, v_type, v_overdraft)
    RETURNING account_id INTO v_id;

    IF v_initial > 0 THEN
      UPDATE accounts SET balance = v_initial WHERE account_id = v_id;
      log_tx(v_id, 'DEPOT', v_initial, v_initial, NULL);
    END IF;

    COMMIT;
    RETURN v_no;
  END open_account;

  PROCEDURE deposit(p_account_no IN VARCHAR2, p_amount IN NUMBER) IS
    v_acc accounts%ROWTYPE;
    v_amt NUMBER := ROUND(p_amount, 2);
  BEGIN
    check_amount(v_amt);
    v_acc := lock_account(p_account_no);
    require_active(v_acc);

    UPDATE accounts SET balance = balance + v_amt WHERE account_id = v_acc.account_id;
    log_tx(v_acc.account_id, 'DEPOT', v_amt, v_acc.balance + v_amt, NULL);
    COMMIT;
  END deposit;

  PROCEDURE withdraw(p_account_no IN VARCHAR2, p_amount IN NUMBER) IS
    v_acc accounts%ROWTYPE;
    v_amt NUMBER := ROUND(p_amount, 2);
  BEGIN
    check_amount(v_amt);
    v_acc := lock_account(p_account_no);
    require_active(v_acc);

    IF v_acc.balance - v_amt < -v_acc.overdraft_limit THEN
      RAISE_APPLICATION_ERROR(-20001, 'Solde insuffisant sur le compte ' || p_account_no);
    END IF;

    UPDATE accounts SET balance = balance - v_amt WHERE account_id = v_acc.account_id;
    log_tx(v_acc.account_id, 'RETRAIT', v_amt, v_acc.balance - v_amt, NULL);
    COMMIT;
  END withdraw;

  PROCEDURE transfer(p_from_account IN VARCHAR2, p_to_account IN VARCHAR2, p_amount IN NUMBER) IS
    v_from accounts%ROWTYPE;
    v_to   accounts%ROWTYPE;
    v_amt  NUMBER := ROUND(p_amount, 2);
  BEGIN
    check_amount(v_amt);
    IF p_from_account = p_to_account THEN
      RAISE_APPLICATION_ERROR(-20005, 'Le compte source et le compte destination sont identiques');
    END IF;

    -- Verrouillage dans un ordre déterministe : deux virements croisés ne peuvent pas se bloquer (deadlock)
    IF p_from_account < p_to_account THEN
      v_from := lock_account(p_from_account);
      v_to   := lock_account(p_to_account);
    ELSE
      v_to   := lock_account(p_to_account);
      v_from := lock_account(p_from_account);
    END IF;

    require_active(v_from);
    require_active(v_to);

    IF v_from.balance - v_amt < -v_from.overdraft_limit THEN
      RAISE_APPLICATION_ERROR(-20001, 'Solde insuffisant sur le compte ' || p_from_account);
    END IF;

    UPDATE accounts SET balance = balance - v_amt WHERE account_id = v_from.account_id;
    UPDATE accounts SET balance = balance + v_amt WHERE account_id = v_to.account_id;

    log_tx(v_from.account_id, 'VIREMENT_DEBIT',  v_amt, v_from.balance - v_amt, v_to.account_id);
    log_tx(v_to.account_id,   'VIREMENT_CREDIT', v_amt, v_to.balance   + v_amt, v_from.account_id);
    COMMIT;
  END transfer;

  FUNCTION get_balance(p_account_no IN VARCHAR2) RETURN NUMBER IS
    v_balance accounts.balance%TYPE;
  BEGIN
    SELECT balance INTO v_balance FROM accounts WHERE account_no = p_account_no;
    RETURN v_balance;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20004, 'Compte introuvable : ' || p_account_no);
  END get_balance;

  FUNCTION statement(p_account_no IN VARCHAR2, p_limit IN NUMBER DEFAULT 50) RETURN SYS_REFCURSOR IS
    v_cur SYS_REFCURSOR;
    v_id  accounts.account_id%TYPE;
  BEGIN
    BEGIN
      SELECT account_id INTO v_id FROM accounts WHERE account_no = p_account_no;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20004, 'Compte introuvable : ' || p_account_no);
    END;

    OPEN v_cur FOR
      SELECT * FROM (
        SELECT t.tx_id, t.tx_date, t.tx_type, t.amount, t.balance_after,
               a2.account_no AS counterpart
          FROM transactions t
          LEFT JOIN accounts a2 ON a2.account_id = t.related_account_id
         WHERE t.account_id = v_id
         ORDER BY t.tx_id DESC)
       WHERE ROWNUM <= p_limit;
    RETURN v_cur;
  END statement;

END bank_pkg;
/

SHOW ERRORS
EXIT
