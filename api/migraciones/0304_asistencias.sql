CREATE TABLE asistencia (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), sesion_id uuid NOT NULL REFERENCES sesion(id), catequizando_id uuid NOT NULL REFERENCES catequizando(id),
 valor text NOT NULL CHECK(valor IN ('presente','ausente')), tipo_registro text NOT NULL CHECK(tipo_registro IN ('escaneo','manual','lista')),
 hora_primer_registro timestamptz NOT NULL, recibido_primer_registro timestamptz NOT NULL,
 corregida boolean NOT NULL, conflicto boolean NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz,
 UNIQUE(sesion_id,catequizando_id)
);
CREATE TRIGGER asistencia_sello BEFORE INSERT OR UPDATE ON asistencia FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER asistencia_ciclo BEFORE INSERT OR UPDATE OR DELETE ON asistencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT,UPDATE ON asistencia TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON asistencia TO sigecat_retencion;
