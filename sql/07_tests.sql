-- 07_tests.sql — tests de non-régression (exécuté en BANK_OWNER après le seed)
-- Tous les tests sont neutres : les soldes reviennent à leur valeur initiale.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF
SET SERVEROUTPUT ON SIZE UNLIMITED

DECLARE
  v_a1 VARCHAR2(20);
  v_a4 VARCHAR2(20);
  v_b1 NUMBER; v_b4 NUMBER; v_total NUMBER;
  v_audit_before NUMBER; v_audit_after NUMBER;
  v_ok BOOLEAN;

  PROCEDURE check_(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF NOT p_cond THEN
      RAISE_APPLICATION_ERROR(-20900, 'ÉCHEC : ' || p_name);
    END IF;
    DBMS_OUTPUT.PUT_LINE('  OK  ' || p_name);
  END;
BEGIN
  SELECT a.account_no INTO v_a1 FROM accounts a JOIN clients c ON c.client_id = a.client_id
   WHERE c.email = 'aminatou.sagbo@example.com' AND a.account_type = 'COURANT';
  SELECT a.account_no INTO v_a4 FROM accounts a JOIN clients c ON c.client_id = a.client_id
   WHERE c.email = 'fatoumata.bio@example.com';

  v_b1 := bank_pkg.get_balance(v_a1);
  v_b4 := bank_pkg.get_balance(v_a4);
  v_total := v_b1 + v_b4;
  SELECT COUNT(*) INTO v_audit_before FROM audit_log;

  DBMS_OUTPUT.PUT_LINE('Tests BankCore');

  -- 1. Dépôt puis retrait du même montant
  bank_pkg.deposit(v_a1, 1000);
  check_('dépôt crédite le compte', bank_pkg.get_balance(v_a1) = v_b1 + 1000);
  bank_pkg.withdraw(v_a1, 1000);
  check_('retrait ramène le solde initial', bank_pkg.get_balance(v_a1) = v_b1);

  -- 2. Virement aller-retour : la somme des soldes est conservée
  bank_pkg.transfer(v_a1, v_a4, 5000);
  check_('virement conserve la somme des soldes',
         bank_pkg.get_balance(v_a1) + bank_pkg.get_balance(v_a4) = v_total);
  bank_pkg.transfer(v_a4, v_a1, 5000);
  check_('virement retour restaure les soldes',
         bank_pkg.get_balance(v_a1) = v_b1 AND bank_pkg.get_balance(v_a4) = v_b4);

  -- 3. Règles métier
  v_ok := FALSE;
  BEGIN bank_pkg.withdraw(v_a1, 10000000);
  EXCEPTION WHEN bank_pkg.e_insufficient_funds THEN v_ok := TRUE; END;
  check_('retrait au-delà du découvert refusé', v_ok);

  v_ok := FALSE;
  BEGIN bank_pkg.deposit(v_a1, -5);
  EXCEPTION WHEN bank_pkg.e_invalid_amount THEN v_ok := TRUE; END;
  check_('montant négatif refusé', v_ok);

  v_ok := FALSE;
  BEGIN bank_pkg.transfer(v_a1, v_a1, 100);
  EXCEPTION WHEN bank_pkg.e_same_account THEN v_ok := TRUE; END;
  check_('virement vers le même compte refusé', v_ok);

  v_ok := FALSE;
  BEGIN v_b1 := bank_pkg.get_balance('BJ0000000000');
  EXCEPTION WHEN bank_pkg.e_account_not_found THEN v_ok := TRUE; END;
  check_('compte inconnu refusé', v_ok);
  v_b1 := bank_pkg.get_balance(v_a1);

  -- 4. Triggers d'intégrité
  v_ok := FALSE;
  BEGIN UPDATE transactions SET amount = amount + 1 WHERE ROWNUM = 1;
  EXCEPTION WHEN OTHERS THEN v_ok := (SQLCODE = -20010); END;
  check_('trigger : transactions non modifiables', v_ok);

  v_ok := FALSE;
  BEGIN DELETE FROM accounts WHERE account_no = v_a1;
  EXCEPTION WHEN OTHERS THEN v_ok := (SQLCODE = -20011); END;
  check_('trigger : suppression de compte interdite', v_ok);
  ROLLBACK;

  -- 5. Audit
  SELECT COUNT(*) INTO v_audit_after FROM audit_log;
  check_('trigger : les changements de solde sont audités', v_audit_after >= v_audit_before + 4);

  DBMS_OUTPUT.PUT_LINE('Tous les tests sont passés.');
END;
/
EXIT
