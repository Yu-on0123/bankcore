-- 02_schema.sql — exécuté en BANK_OWNER
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF

CREATE SEQUENCE seq_account_no START WITH 1000000001 INCREMENT BY 1 NOCACHE;

CREATE TABLE clients (
  client_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name  VARCHAR2(60)  NOT NULL,
  last_name   VARCHAR2(60)  NOT NULL,
  email       VARCHAR2(120) NOT NULL,
  phone       VARCHAR2(30),
  created_at  TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uq_clients_email UNIQUE (email),
  CONSTRAINT ck_clients_email CHECK (INSTR(email, '@') > 1)
);

CREATE TABLE accounts (
  account_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_no      VARCHAR2(20) NOT NULL,
  client_id       NUMBER NOT NULL,
  account_type    VARCHAR2(10) DEFAULT 'COURANT' NOT NULL,
  balance         NUMBER(15,2) DEFAULT 0 NOT NULL,
  overdraft_limit NUMBER(15,2) DEFAULT 0 NOT NULL,
  status          VARCHAR2(10) DEFAULT 'ACTIF' NOT NULL,
  opened_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uq_accounts_no     UNIQUE (account_no),
  CONSTRAINT fk_accounts_client FOREIGN KEY (client_id) REFERENCES clients (client_id),
  CONSTRAINT ck_accounts_type   CHECK (account_type IN ('COURANT', 'EPARGNE')),
  CONSTRAINT ck_accounts_status CHECK (status IN ('ACTIF', 'BLOQUE', 'CLOTURE')),
  CONSTRAINT ck_accounts_overdr CHECK (overdraft_limit >= 0),
  CONSTRAINT ck_accounts_bal    CHECK (balance >= -overdraft_limit)
);

CREATE TABLE transactions (
  tx_id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id         NUMBER NOT NULL,
  tx_type            VARCHAR2(20) NOT NULL,
  amount             NUMBER(15,2) NOT NULL,
  balance_after      NUMBER(15,2) NOT NULL,
  related_account_id NUMBER,
  tx_date            TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT fk_tx_account  FOREIGN KEY (account_id) REFERENCES accounts (account_id),
  CONSTRAINT fk_tx_related  FOREIGN KEY (related_account_id) REFERENCES accounts (account_id),
  CONSTRAINT ck_tx_type     CHECK (tx_type IN ('DEPOT', 'RETRAIT', 'VIREMENT_DEBIT', 'VIREMENT_CREDIT')),
  CONSTRAINT ck_tx_amount   CHECK (amount > 0)
);

CREATE TABLE audit_log (
  audit_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  VARCHAR2(30) NOT NULL,
  operation   VARCHAR2(10) NOT NULL,
  record_id   NUMBER,
  old_value   VARCHAR2(400),
  new_value   VARCHAR2(400),
  db_user     VARCHAR2(128) DEFAULT SYS_CONTEXT('USERENV', 'SESSION_USER'),
  client_ip   VARCHAR2(64)  DEFAULT SYS_CONTEXT('USERENV', 'IP_ADDRESS'),
  changed_at  TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_accounts_client ON accounts (client_id);
CREATE INDEX idx_tx_account      ON transactions (account_id, tx_id DESC);
CREATE INDEX idx_tx_related      ON transactions (related_account_id);

COMMENT ON TABLE clients      IS 'Clients de la banque';
COMMENT ON TABLE accounts     IS 'Comptes bancaires (courant / épargne)';
COMMENT ON TABLE transactions IS 'Journal comptable immuable des mouvements';
COMMENT ON TABLE audit_log    IS 'Audit des modifications sensibles (rempli par trigger)';

EXIT
