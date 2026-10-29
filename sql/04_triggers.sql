-- 04_triggers.sql — audit, intégrité et normalisation
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF

-- Audit automatique des changements de solde, statut ou découvert
CREATE OR REPLACE TRIGGER trg_accounts_audit
AFTER UPDATE OF balance, status, overdraft_limit ON accounts
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, operation, record_id, old_value, new_value)
  VALUES ('ACCOUNTS', 'UPDATE', :OLD.account_id,
          'balance=' || :OLD.balance || ';status=' || :OLD.status || ';overdraft=' || :OLD.overdraft_limit,
          'balance=' || :NEW.balance || ';status=' || :NEW.status || ';overdraft=' || :NEW.overdraft_limit);
END;
/

-- Le journal des transactions ne se modifie ni ne se supprime jamais
CREATE OR REPLACE TRIGGER trg_transactions_immutable
BEFORE UPDATE OR DELETE ON transactions
BEGIN
  RAISE_APPLICATION_ERROR(-20010, 'Les transactions sont immuables (journal comptable)');
END;
/

-- Un compte ne se supprime pas : on le clôture (status = CLOTURE)
CREATE OR REPLACE TRIGGER trg_accounts_no_delete
BEFORE DELETE ON accounts
BEGIN
  RAISE_APPLICATION_ERROR(-20011, 'Suppression interdite : passer le compte au statut CLOTURE');
END;
/

-- Normalisation de l'email (insensible à la casse, sans espaces)
CREATE OR REPLACE TRIGGER trg_clients_normalize
BEFORE INSERT OR UPDATE OF email ON clients
FOR EACH ROW
BEGIN
  :NEW.email := LOWER(TRIM(:NEW.email));
END;
/

SHOW ERRORS

-- Garde-fou : le déploiement échoue si un objet est invalide
DECLARE
  v_invalid NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_invalid FROM user_objects WHERE status = 'INVALID';
  IF v_invalid > 0 THEN
    RAISE_APPLICATION_ERROR(-20999, v_invalid || ' objet(s) invalide(s) — voir USER_ERRORS');
  END IF;
END;
/
EXIT
