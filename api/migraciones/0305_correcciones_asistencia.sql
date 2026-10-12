CREATE TABLE correccion_asistencia (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), sesion_id uuid NOT NULL, catequizando_id uuid REFERENCES catequizando(id),
 valor_anterior text NOT NULL CHECK(valor_anterior IN ('presente','ausente')), valor_nuevo text NOT NULL CHECK(valor_nuevo IN ('presente','ausente')), motivo varchar(300),
 corregido_por uuid REFERENCES cuenta(id), cuenta_id uuid REFERENCES cuenta(id), credencial_id uuid REFERENCES credencial(id), dispositivo_id uuid,
 hora_dispositivo timestamptz NOT NULL, desfase_reloj_ms bigint NOT NULL, recibido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 estado text NOT NULL CHECK(estado IN ('aceptada','rechazada')), motivo_rechazo text, huella_peticion text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz
);
CREATE INDEX correccion_asistencia_par ON correccion_asistencia(sesion_id,catequizando_id,recibido_en,id);
CREATE TRIGGER correccion_inmutable BEFORE UPDATE OR DELETE ON correccion_asistencia FOR EACH ROW EXECUTE FUNCTION asistencia_historia_inmutable();
CREATE TRIGGER correccion_sello BEFORE INSERT OR UPDATE ON correccion_asistencia FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER correccion_ciclo BEFORE INSERT OR UPDATE OR DELETE ON correccion_asistencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT ON correccion_asistencia TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON correccion_asistencia TO sigecat_retencion;
