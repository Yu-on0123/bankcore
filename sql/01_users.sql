-- 01_users.sql - exécuté en SYS dans XEPDB1 (rejouable : les objets existants sont conservés)
-- Les arguments de la ligne de commande deviennent les variables de substitution &1 (owner), &2 (app), &3 (auditor)
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET VERIFY OFF
SET DEFINE ON
SET ECHO OFF
SET SERVEROUTPUT ON

-- Exécute un ordre DDL en ignorant uniquement l'erreur « existe déjà » (p_dup)
CREATE OR REPLACE PROCEDURE bank_tmp_ddl(p_sql IN VARCHAR2, p_dup IN NUMBER) IS
BEGIN
  EXECUTE IMMEDIATE p_sql;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE <> p_dup THEN RAISE; END IF;
END;
/

PROMPT == Profile
BEGIN
  bank_tmp_ddl('CREATE PROFILE bank_profile LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24 SESSIONS_PER_USER 20', -2379);
END;
/

PROMPT == Roles
BEGIN
  bank_tmp_ddl('CREATE ROLE role_teller',  -1921);
  bank_tmp_ddl('CREATE ROLE role_auditor', -1921);
END;
/

PROMPT == User BANK_OWNER
BEGIN
  bank_tmp_ddl('CREATE USER bank_owner IDENTIFIED BY "&1" DEFAULT TABLESPACE users QUOTA UNLIMITED ON users PROFILE bank_profile', -1920);
END;
/
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE,
      CREATE PROCEDURE, CREATE TRIGGER TO bank_owner;

PROMPT == User BANK_APP
BEGIN
  bank_tmp_ddl('CREATE USER bank_app IDENTIFIED BY "&2" PROFILE bank_profile', -1920);
END;
/
GRANT CREATE SESSION TO bank_app;
GRANT role_teller TO bank_app;

PROMPT == User BANK_AUDITOR
BEGIN
  bank_tmp_ddl('CREATE USER bank_auditor IDENTIFIED BY "&3" PROFILE bank_profile', -1920);
END;
/
GRANT CREATE SESSION TO bank_auditor;
GRANT role_auditor TO bank_auditor;

PROMPT == Data Pump directory
CREATE OR REPLACE DIRECTORY bank_backup_dir AS '/opt/oracle/backup';
GRANT READ, WRITE ON DIRECTORY bank_backup_dir TO system;

DROP PROCEDURE bank_tmp_ddl;

PROMPT == 01_users.sql done
EXIT
