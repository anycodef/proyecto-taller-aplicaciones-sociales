CREATE TABLE evento_asistencia (
 secuencia bigserial PRIMARY KEY, tipo text NOT NULL, ciclo_id uuid NOT NULL REFERENCES ciclo(id),
 catequizando_id uuid REFERENCES catequizando(id), fecha date NOT NULL, creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER evento_asistencia_inmutable BEFORE UPDATE OR DELETE ON evento_asistencia FOR EACH ROW EXECUTE FUNCTION asistencia_historia_inmutable();
CREATE TRIGGER evento_asistencia_ciclo BEFORE INSERT OR UPDATE OR DELETE ON evento_asistencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT ON evento_asistencia TO sigecat_api;
GRANT USAGE,SELECT ON SEQUENCE evento_asistencia_secuencia_seq TO sigecat_api,sigecat_retencion;
GRANT SELECT,INSERT,UPDATE,DELETE ON evento_asistencia TO sigecat_retencion;
