-- 05_views_grants.sql — vues de lecture et attribution des privilèges aux rôles
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF

CREATE OR REPLACE VIEW v_account_summary AS
SELECT a.account_no,
       c.first_name || ' ' || c.last_name AS client_name,
       c.email,
       a.account_type,
       a.balance,
       a.overdraft_limit,
       a.status
  FROM accounts a
  JOIN clients c ON c.client_id = a.client_id;

-- Clients avec leur nombre de comptes (sans exposer la table clients : nécessaire pour ouvrir un compte)
CREATE OR REPLACE VIEW v_client_summary AS
SELECT c.client_id,
       c.first_name,
       c.last_name,
       c.first_name || ' ' || c.last_name AS full_name,
       c.email,
       c.phone,
       c.created_at,
       (SELECT COUNT(*) FROM accounts a WHERE a.client_id = c.client_id) AS account_count
  FROM clients c;

CREATE OR REPLACE VIEW v_audit_recent AS
SELECT audit_id, changed_at, db_user, client_ip, table_name, operation, record_id, old_value, new_value
  FROM audit_log
 ORDER BY audit_id DESC
 FETCH FIRST 100 ROWS ONLY;

-- Guichetier : exécute le package, lit le récapitulatif des comptes. Rien d'autre.
GRANT EXECUTE ON bank_pkg          TO role_teller;
GRANT SELECT  ON v_account_summary TO role_teller;
GRANT SELECT  ON v_client_summary  TO role_teller;

-- Auditeur : lecture seule, journal d'audit compris
GRANT SELECT ON v_account_summary TO role_auditor;
GRANT SELECT ON v_client_summary  TO role_auditor;
GRANT SELECT ON v_audit_recent    TO role_auditor;
GRANT SELECT ON transactions      TO role_auditor;

EXIT
