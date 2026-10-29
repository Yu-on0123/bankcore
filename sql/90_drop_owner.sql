-- 90_drop_owner.sql — utilisé par restore.ps1 avant l'import (exécuté en SYS)
WHENEVER SQLERROR EXIT SQL.SQLCODE
DROP USER bank_owner CASCADE;
EXIT
