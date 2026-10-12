CREATE TABLE sesion (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), fecha date NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('misa','catequesis','actividad')), actividad_id uuid,
 ventana_inicio time, ventana_fin time, cancelada boolean NOT NULL DEFAULT false, motivo_cancelacion varchar(300),
 actualizado_por uuid REFERENCES cuenta(id), cuenta_id uuid REFERENCES cuenta(id), credencial_id uuid REFERENCES credencial(id), dispositivo_id uuid,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz,
 CHECK((tipo='actividad')=(actividad_id IS NOT NULL)), CHECK(NOT cancelada OR length(trim(motivo_cancelacion))>0),
 CHECK(ventana_inicio IS NULL OR ventana_fin IS NULL OR ventana_fin>ventana_inicio)
);
CREATE UNIQUE INDEX sesion_dominical ON sesion(ciclo_id,fecha,tipo) WHERE actividad_id IS NULL;
CREATE UNIQUE INDEX sesion_actividad ON sesion(ciclo_id,fecha,actividad_id) WHERE actividad_id IS NOT NULL;
CREATE TRIGGER sesion_sello BEFORE INSERT OR UPDATE ON sesion FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER sesion_ciclo BEFORE INSERT OR UPDATE OR DELETE ON sesion FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT,UPDATE ON sesion TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON sesion TO sigecat_retencion;
