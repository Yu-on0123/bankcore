-- 08_is_deployed.sql - exécuté en SYS : affiche 1 si le schéma BANK_OWNER est déjà déployé, sinon 0
SET HEADING OFF FEEDBACK OFF PAGESIZE 0 VERIFY OFF ECHO OFF
SELECT COUNT(*) FROM dba_tables WHERE owner = 'BANK_OWNER' AND table_name = 'ACCOUNTS';
EXIT
