DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigecat_migrador') THEN CREATE ROLE sigecat_migrador LOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigecat_api') THEN CREATE ROLE sigecat_api LOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sigecat_retencion') THEN CREATE ROLE sigecat_retencion NOLOGIN; END IF;
END $$;
GRANT sigecat_retencion TO sigecat_api;
GRANT USAGE ON SCHEMA public TO sigecat_api,sigecat_retencion;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
SET TIME ZONE 'America/Lima';
