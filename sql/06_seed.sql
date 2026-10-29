-- 06_seed.sql — jeu de données de démonstration (via le package, donc avec audit et journal)
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF

DECLARE
  v_c1 NUMBER; v_c2 NUMBER; v_c3 NUMBER;
  v_a1 VARCHAR2(20); v_a2 VARCHAR2(20); v_a3 VARCHAR2(20); v_a4 VARCHAR2(20);
BEGIN
  bank_pkg.create_client('Aminatou', 'Sagbo',  'aminatou.sagbo@example.com',  '+22997000001', v_c1);
  bank_pkg.create_client('Koffi',    'Adjovi', 'koffi.adjovi@example.com',    '+22997000002', v_c2);
  bank_pkg.create_client('Fatoumata','Bio',    'fatoumata.bio@example.com',   '+22997000003', v_c3);

  v_a1 := bank_pkg.open_account(v_c1, 'COURANT', 200000, 500000);
  v_a2 := bank_pkg.open_account(v_c1, 'EPARGNE', 0,      1000000);
  v_a3 := bank_pkg.open_account(v_c2, 'COURANT', 100000, 250000);
  v_a4 := bank_pkg.open_account(v_c3, 'COURANT', 0,      150000);

  bank_pkg.deposit (v_a1, 75000);
  bank_pkg.withdraw(v_a1, 30000);
  bank_pkg.transfer(v_a1, v_a2, 100000);
  bank_pkg.transfer(v_a3, v_a4, 50000);
END;
/
EXIT
