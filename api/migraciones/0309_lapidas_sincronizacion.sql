CREATE TABLE lapida_sincronizacion (
 tabla text NOT NULL CHECK(tabla IN ('asistencias','marcas_asistencia','correcciones_asistencia','listas_asistencia')),
 fila_id uuid NOT NULL,
 cuenta_id uuid REFERENCES cuenta(id),
 ciclo_id uuid NOT NULL REFERENCES ciclo(id),
 eliminado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE NULLS NOT DISTINCT(tabla,fila_id,cuenta_id)
);
CREATE INDEX lapida_sincronizacion_destinatario ON lapida_sincronizacion(cuenta_id,eliminado_en);
CREATE INDEX lapida_sincronizacion_fecha ON lapida_sincronizacion(eliminado_en);
CREATE FUNCTION lapida_exigir_retencion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user <> 'sigecat_retencion' OR COALESCE(current_setting('sigecat.contexto',true),'') NOT IN ('retiro_consentimiento','retencion') THEN
  RAISE EXCEPTION 'fuera_de_alcance' USING ERRCODE='42501';
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER lapida_retencion BEFORE INSERT OR UPDATE OR DELETE ON lapida_sincronizacion FOR EACH ROW EXECUTE FUNCTION lapida_exigir_retencion();
GRANT SELECT ON lapida_sincronizacion TO sigecat_api,sigecat_retencion;
GRANT INSERT,DELETE ON lapida_sincronizacion TO sigecat_retencion;
