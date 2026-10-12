CREATE TABLE actividad_obligatoria (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), nombre text NOT NULL CHECK(length(trim(nombre)) BETWEEN 1 AND 150),
 tipo text NOT NULL CHECK(tipo IN ('jornada','retiro','viacrucis','posada','misa_precepto','semana_santa')),
 fecha date NOT NULL, estado text NOT NULL DEFAULT 'vigente' CHECK(estado IN ('vigente','cancelada')),
 creado_por uuid REFERENCES cuenta(id), actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz
);
CREATE INDEX actividad_ciclo ON actividad_obligatoria(ciclo_id);
CREATE TRIGGER actividad_ciclo_cerrado BEFORE INSERT OR UPDATE OR DELETE ON actividad_obligatoria FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
ALTER TABLE sesion ADD CONSTRAINT sesion_actividad_fk FOREIGN KEY(actividad_id) REFERENCES actividad_obligatoria(id);
GRANT SELECT,INSERT,UPDATE ON actividad_obligatoria TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON actividad_obligatoria TO sigecat_retencion;
