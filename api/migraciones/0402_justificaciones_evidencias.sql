CREATE TABLE evidencia (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), subida_por uuid NOT NULL REFERENCES cuenta(id),
 estado text NOT NULL DEFAULT 'reservada' CHECK(estado IN ('reservada','confirmada','eliminada')),
 reservada_en timestamptz NOT NULL DEFAULT clock_timestamp(), confirmada_en timestamptz, eliminada_en timestamptz,
 motivo_eliminacion text CHECK(motivo_eliminacion IN ('consentimiento','retencion','huerfana')),
 CHECK(estado<>'confirmada' OR confirmada_en IS NOT NULL),
 CHECK((estado='eliminada')=(eliminada_en IS NOT NULL)),
 CHECK((estado='eliminada')=(motivo_eliminacion IS NOT NULL))
);
CREATE INDEX evidencia_reservada ON evidencia(reservada_en) WHERE estado='reservada';
CREATE INDEX evidencia_cuenta ON evidencia(subida_por,reservada_en);
CREATE TABLE evidencia_archivo (
 evidencia_id uuid NOT NULL REFERENCES evidencia(id), orden smallint NOT NULL CHECK(orden BETWEEN 1 AND 3),
 blob_nombre text NOT NULL UNIQUE, bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 307200),
 content_type text NOT NULL CHECK(content_type='image/jpeg'),
 PRIMARY KEY(evidencia_id,orden)
);
-- Solo se reserva en un ciclo abierto; el borrado por consentimiento o retención debe poder ocurrir después.
CREATE TRIGGER evidencia_ciclo BEFORE INSERT ON evidencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT,UPDATE ON evidencia TO sigecat_api;
GRANT SELECT,INSERT ON evidencia_archivo TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON evidencia,evidencia_archivo TO sigecat_retencion;
