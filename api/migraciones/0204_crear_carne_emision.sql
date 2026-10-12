CREATE TABLE carne_emision (
 catequizando_id uuid NOT NULL REFERENCES catequizando(id), emision integer NOT NULL CHECK (emision>0),
 emitida_en timestamptz NOT NULL DEFAULT clock_timestamp(), emitida_por uuid NOT NULL REFERENCES cuenta(id), invalidada_en timestamptz,
 PRIMARY KEY (catequizando_id,emision)
);
CREATE UNIQUE INDEX carne_emision_vigente ON carne_emision(catequizando_id) WHERE invalidada_en IS NULL;
CREATE FUNCTION catequizando_actualizar_nomina() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE nino uuid;
BEGIN
 IF TG_TABLE_NAME='asignacion_grupo' THEN
  SELECT catequizando_id INTO nino FROM inscripcion WHERE id=COALESCE(NEW.inscripcion_id,OLD.inscripcion_id);
 ELSE nino := COALESCE(NEW.catequizando_id,OLD.catequizando_id); END IF;
 UPDATE catequizando SET actualizado_en=clock_timestamp() WHERE id=nino;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER inscripcion_nomina AFTER INSERT OR UPDATE OR DELETE ON inscripcion FOR EACH ROW EXECUTE FUNCTION catequizando_actualizar_nomina();
CREATE TRIGGER asignacion_nomina AFTER INSERT OR UPDATE OR DELETE ON asignacion_grupo FOR EACH ROW EXECUTE FUNCTION catequizando_actualizar_nomina();
CREATE TRIGGER carne_nomina AFTER INSERT OR UPDATE OR DELETE ON carne_emision FOR EACH ROW EXECUTE FUNCTION catequizando_actualizar_nomina();
CREATE VIEW v_nomina_ciclo AS
 SELECT n.id AS catequizando_id,n.nombres,n.apellidos,i.ciclo_id,a.grupo_id,e.emision,n.actualizado_en
 FROM catequizando n JOIN inscripcion i ON i.catequizando_id=n.id AND i.estado='vigente'
 JOIN ciclo c ON c.id=i.ciclo_id AND c.estado='abierto'
 JOIN asignacion_grupo a ON a.inscripcion_id=i.id AND a.hasta IS NULL
 LEFT JOIN carne_emision e ON e.catequizando_id=n.id AND e.invalidada_en IS NULL
 WHERE n.estado='vigente';
GRANT SELECT, INSERT, UPDATE, DELETE ON carne_emision TO sigecat_api, sigecat_retencion;
GRANT SELECT ON v_nomina_ciclo TO sigecat_api, sigecat_retencion;
