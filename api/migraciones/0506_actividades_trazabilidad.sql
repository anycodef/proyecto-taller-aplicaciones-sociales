ALTER TABLE actividad_obligatoria ADD COLUMN cuenta_id uuid REFERENCES cuenta(id),
 ADD COLUMN credencial_id uuid REFERENCES credencial(id), ADD COLUMN dispositivo_id uuid,
 ADD COLUMN huella_creacion text;
CREATE TRIGGER actividad_sello_sync BEFORE INSERT OR UPDATE ON actividad_obligatoria FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TABLE cambio_actividad (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), actividad_id uuid NOT NULL REFERENCES actividad_obligatoria(id),
 campo text NOT NULL CHECK(campo IN ('nombre','tipo','fecha','estado')),
 valor_anterior text NOT NULL, valor_nuevo text NOT NULL, cambiado_por uuid NOT NULL REFERENCES cuenta(id), cambiado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX cambio_actividad_ciclo ON cambio_actividad(ciclo_id);
CREATE TRIGGER cambio_actividad_ciclo_cerrado BEFORE INSERT OR UPDATE OR DELETE ON cambio_actividad FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
CREATE FUNCTION cambio_actividad_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retencion','retiro_consentimiento') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'cambio_inmutable' USING ERRCODE='SG504';
END $$;
CREATE TRIGGER cambio_actividad_inmutable BEFORE UPDATE OR DELETE ON cambio_actividad FOR EACH ROW EXECUTE FUNCTION cambio_actividad_inmutable();
GRANT SELECT,INSERT ON cambio_actividad TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON cambio_actividad TO sigecat_retencion;
