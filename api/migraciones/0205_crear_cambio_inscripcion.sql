CREATE TABLE cambio_inscripcion (
 id uuid PRIMARY KEY, catequizando_id uuid NOT NULL REFERENCES catequizando(id),
 entidad text NOT NULL CHECK (entidad IN ('catequizando','apoderado','vinculo_apoderado','inscripcion','documento_inscripcion','asignacion_grupo')),
 entidad_id uuid NOT NULL, campo text NOT NULL, valor_anterior jsonb, valor_nuevo jsonb,
 cambiado_por uuid NOT NULL REFERENCES cuenta(id), cambiado_en timestamptz NOT NULL DEFAULT clock_timestamp(), motivo text
);
CREATE TRIGGER cambio_inmutable BEFORE UPDATE OR DELETE ON cambio_inscripcion FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_inmutable();
GRANT SELECT, INSERT ON cambio_inscripcion TO sigecat_api;
REVOKE UPDATE, DELETE ON cambio_inscripcion FROM sigecat_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON cambio_inscripcion TO sigecat_retencion;
