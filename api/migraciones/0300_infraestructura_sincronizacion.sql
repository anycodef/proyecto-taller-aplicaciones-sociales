CREATE OR REPLACE FUNCTION fijar_actualizado_en() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en := clock_timestamp(); RETURN NEW; END $$;
ALTER TABLE catequizando ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE catequizando ADD COLUMN IF NOT EXISTS eliminado_en timestamptz;
ALTER TABLE grupo ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE grupo ADD COLUMN IF NOT EXISTS eliminado_en timestamptz;
CREATE TRIGGER catequizando_sello_sync BEFORE INSERT OR UPDATE ON catequizando FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER grupo_sello_sync BEFORE INSERT OR UPDATE ON grupo FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TABLE bitacora_sincronizacion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cuenta_id uuid REFERENCES cuenta(id), dispositivo_id uuid,
 operacion text NOT NULL CHECK(operacion IN ('pull','push')), recibido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 duracion_ms integer NOT NULL CHECK(duracion_ms>=0), bytes_entrada integer NOT NULL CHECK(bytes_entrada>=0), bytes_salida integer NOT NULL CHECK(bytes_salida>=0),
 aceptados integer NOT NULL DEFAULT 0, rechazados integer NOT NULL DEFAULT 0, descartados_cierre integer NOT NULL DEFAULT 0,
 version_esquema integer NOT NULL CHECK(version_esquema>0)
);
CREATE INDEX bitacora_sincronizacion_cuenta_fecha ON bitacora_sincronizacion(cuenta_id,recibido_en);
GRANT SELECT,INSERT ON bitacora_sincronizacion TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON bitacora_sincronizacion TO sigecat_retencion;
