CREATE TABLE justificacion_plazo (
 ciclo_id uuid PRIMARY KEY REFERENCES ciclo(id),
 dias_plazo integer NOT NULL CHECK(dias_plazo BETWEEN 1 AND 60),
 definido_por uuid NOT NULL REFERENCES cuenta(id),
 definido_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER justificacion_plazo_ciclo BEFORE INSERT OR UPDATE OR DELETE ON justificacion_plazo FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT,UPDATE ON justificacion_plazo TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON justificacion_plazo TO sigecat_retencion;
