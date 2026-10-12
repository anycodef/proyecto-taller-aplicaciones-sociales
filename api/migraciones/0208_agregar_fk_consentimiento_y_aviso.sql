ALTER TABLE consentimiento ADD CONSTRAINT consentimiento_catequizando_fk FOREIGN KEY(catequizando_id) REFERENCES catequizando(id);
ALTER TABLE consentimiento ADD CONSTRAINT consentimiento_apoderado_fk FOREIGN KEY(apoderado_id) REFERENCES apoderado(id);
ALTER TABLE aviso_grupo ADD CONSTRAINT aviso_grupo_grupo_fk FOREIGN KEY(grupo_id) REFERENCES grupo(id);
CREATE FUNCTION catequizando_validar_ciclo_relacionado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ciclo_objetivo uuid;
BEGIN
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') THEN RETURN COALESCE(NEW,OLD); END IF;
 IF TG_TABLE_NAME='grupo_catequista' THEN
  SELECT ciclo_id INTO ciclo_objetivo FROM grupo WHERE id=COALESCE(NEW.grupo_id,OLD.grupo_id);
 ELSE
  SELECT ciclo_id INTO ciclo_objetivo FROM inscripcion WHERE id=COALESCE(NEW.inscripcion_id,OLD.inscripcion_id);
 END IF;
 IF EXISTS(SELECT 1 FROM ciclo WHERE id=ciclo_objetivo AND estado='cerrado') THEN RAISE EXCEPTION 'ciclo_cerrado' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER grupo_catequista_ciclo_abierto BEFORE INSERT OR UPDATE OR DELETE ON grupo_catequista FOR EACH ROW EXECUTE FUNCTION catequizando_validar_ciclo_relacionado();
CREATE TRIGGER documento_ciclo_abierto BEFORE INSERT OR UPDATE OR DELETE ON documento_inscripcion FOR EACH ROW EXECUTE FUNCTION catequizando_validar_ciclo_relacionado();
CREATE TRIGGER asignacion_ciclo_abierto BEFORE DELETE ON asignacion_grupo FOR EACH ROW EXECUTE FUNCTION catequizando_validar_ciclo_relacionado();
