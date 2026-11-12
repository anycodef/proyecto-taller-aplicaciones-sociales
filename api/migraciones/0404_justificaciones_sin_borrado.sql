-- Una justificación y su evidencia solo se borran por retiro del consentimiento o vencimiento de la retención (RF-407).
CREATE FUNCTION justificacion_impedir_borrado() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'borrado_prohibido' USING ERRCODE='SG401';
END $$;
CREATE TRIGGER justificacion_sin_borrado BEFORE DELETE ON justificacion FOR EACH ROW EXECUTE FUNCTION justificacion_impedir_borrado();
CREATE TRIGGER evidencia_sin_borrado BEFORE DELETE ON evidencia FOR EACH ROW EXECUTE FUNCTION justificacion_impedir_borrado();
CREATE TRIGGER evidencia_archivo_sin_borrado BEFORE DELETE ON evidencia_archivo FOR EACH ROW EXECUTE FUNCTION justificacion_impedir_borrado();
REVOKE DELETE ON justificacion,justificacion_evento,evidencia,evidencia_archivo FROM sigecat_api;

-- Los roles de la aplicación no marcan eliminada directamente: solo la función, que corre como su dueño.
CREATE FUNCTION evidencia_validar_transicion() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF OLD.estado='eliminada' THEN RAISE EXCEPTION 'evidencia_eliminada' USING ERRCODE='SG402'; END IF;
 IF NEW.id<>OLD.id OR NEW.ciclo_id<>OLD.ciclo_id OR NEW.subida_por<>OLD.subida_por OR NEW.reservada_en<>OLD.reservada_en THEN
  RAISE EXCEPTION 'evidencia_inmutable' USING ERRCODE='SG402';
 END IF;
 IF OLD.estado='confirmada' AND NEW.estado='reservada' THEN RAISE EXCEPTION 'evidencia_transicion_invalida' USING ERRCODE='SG402'; END IF;
 IF NEW.estado='eliminada' AND current_user IN ('sigecat_api','sigecat_retencion') THEN RAISE EXCEPTION 'eliminar_con_funcion' USING ERRCODE='SG402'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER evidencia_transicion BEFORE UPDATE ON evidencia FOR EACH ROW EXECUTE FUNCTION evidencia_validar_transicion();

CREATE FUNCTION marcar_evidencia_eliminada(p_evidencia uuid, p_motivo text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 IF p_motivo IS NULL OR p_motivo NOT IN ('consentimiento','retencion','huerfana') THEN RAISE EXCEPTION 'motivo_eliminacion_invalido' USING ERRCODE='22023'; END IF;
 UPDATE public.evidencia SET estado='eliminada', eliminada_en=clock_timestamp(), motivo_eliminacion=p_motivo WHERE id=p_evidencia AND estado<>'eliminada';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION marcar_evidencia_eliminada(uuid,text), justificacion_impedir_borrado(), evidencia_validar_transicion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marcar_evidencia_eliminada(uuid,text) TO sigecat_api,sigecat_retencion;
