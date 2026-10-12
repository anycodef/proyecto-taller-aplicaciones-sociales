CREATE TABLE aviso_asistencia (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), tipo text NOT NULL,
 sesion_id uuid NOT NULL, catequizando_id uuid REFERENCES catequizando(id), marca_id uuid,
 detalle jsonb NOT NULL DEFAULT '{}', estado text NOT NULL DEFAULT 'abierto' CHECK(estado IN ('abierto','atendido')),
 atendido_por uuid REFERENCES cuenta(id), atendido_en timestamptz,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz,
 CHECK(NOT (detalle::text ~* '(salud|condicion|neuro|documento|dni|evidencia|nota_apoyo|identidad_real|codigo_leido)'))
);
CREATE TRIGGER aviso_asistencia_sello BEFORE INSERT OR UPDATE ON aviso_asistencia FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER aviso_asistencia_ciclo BEFORE INSERT OR UPDATE OR DELETE ON aviso_asistencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT,UPDATE ON aviso_asistencia TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON aviso_asistencia TO sigecat_retencion;
