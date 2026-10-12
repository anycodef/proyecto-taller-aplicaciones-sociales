-- La membresía permite SET ROLE, pero nunca debe heredar lectura de identidad_real.
GRANT sigecat_retencion TO sigecat_api WITH SET TRUE;
GRANT sigecat_retencion TO sigecat_api WITH INHERIT FALSE;
REVOKE ALL ON identidad_real FROM sigecat_api;
DO $$ BEGIN
 IF has_table_privilege('sigecat_api','identidad_real','SELECT') THEN
  RAISE EXCEPTION 'identidad_real_accesible_por_api';
 END IF;
END $$;
