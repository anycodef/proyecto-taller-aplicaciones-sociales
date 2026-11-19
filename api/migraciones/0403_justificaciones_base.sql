CREATE TABLE justificacion (
 id uuid PRIMARY KEY, lote_id uuid NOT NULL, ciclo_id uuid NOT NULL REFERENCES ciclo(id),
 catequizando_id uuid NOT NULL REFERENCES catequizando(id), sesion_id uuid NOT NULL REFERENCES sesion(id),
 tipo_sesion text NOT NULL CHECK(tipo_sesion IN ('misa','catequesis','actividad')), fecha_sesion date NOT NULL,
 causa text NOT NULL CHECK(causa IN ('salud_nino','familiar_directo','evento_escolar')), anticipada boolean NOT NULL DEFAULT false,
 evidencia_id uuid NOT NULL REFERENCES evidencia(id),
 -- Apoderado y no cuenta: la coordinación registra en nombre de apoderados que pueden no tener cuenta.
 enviada_por uuid NOT NULL REFERENCES apoderado(id), enviada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 canal text NOT NULL CHECK(canal IN ('enlace','coordinacion')), registrada_por uuid REFERENCES cuenta(id), registrada_en timestamptz,
 estado_revision text NOT NULL DEFAULT 'pendiente' CHECK(estado_revision IN ('pendiente','aprobada','rechazada')),
 revisada_por uuid REFERENCES cuenta(id), revisada_en timestamptz, motivo_rechazo varchar(280),
 sin_efecto_desde timestamptz, actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((canal='coordinacion')=(registrada_por IS NOT NULL AND registrada_en IS NOT NULL)),
 CHECK(canal='coordinacion' OR (registrada_por IS NULL AND registrada_en IS NULL)),
 CHECK((estado_revision='rechazada')=(motivo_rechazo IS NOT NULL)),
 CHECK((estado_revision<>'pendiente')=(revisada_por IS NOT NULL AND revisada_en IS NOT NULL)),
 CHECK(estado_revision<>'pendiente' OR (revisada_por IS NULL AND revisada_en IS NULL)),
 CHECK(NOT anticipada OR causa='evento_escolar')
);
-- Sin unicidad por (niño, sesión): dos apoderados pueden justificar la misma ausencia.
CREATE INDEX justificacion_bandeja ON justificacion(ciclo_id,estado_revision);
CREATE INDEX justificacion_ausencia ON justificacion(catequizando_id,sesion_id);
CREATE INDEX justificacion_lote ON justificacion(lote_id);
CREATE INDEX justificacion_cambios ON justificacion(actualizado_en);
CREATE TRIGGER justificacion_sello BEFORE INSERT OR UPDATE ON justificacion FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER justificacion_ciclo BEFORE INSERT OR UPDATE ON justificacion FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
CREATE TABLE justificacion_evento (
 secuencia bigserial PRIMARY KEY, justificacion_id uuid NOT NULL REFERENCES justificacion(id),
 tipo text NOT NULL CHECK(tipo IN ('creada','aprobada','rechazada','sin_efecto','efecto_restaurado','evidencia_eliminada')),
 por uuid REFERENCES cuenta(id), en timestamptz NOT NULL DEFAULT clock_timestamp(), detalle jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX justificacion_evento_justificacion ON justificacion_evento(justificacion_id);
CREATE TRIGGER justificacion_evento_inmutable BEFORE UPDATE OR DELETE ON justificacion_evento FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_inmutable();
GRANT SELECT,INSERT,UPDATE ON justificacion TO sigecat_api;
GRANT SELECT,INSERT ON justificacion_evento TO sigecat_api;
GRANT USAGE,SELECT ON SEQUENCE justificacion_evento_secuencia_seq TO sigecat_api,sigecat_retencion;
GRANT SELECT,INSERT,UPDATE,DELETE ON justificacion,justificacion_evento TO sigecat_retencion;
