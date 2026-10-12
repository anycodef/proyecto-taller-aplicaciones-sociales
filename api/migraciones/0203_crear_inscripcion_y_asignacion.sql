CREATE TABLE inscripcion (
 id uuid PRIMARY KEY, catequizando_id uuid NOT NULL REFERENCES catequizando(id), ciclo_id uuid NOT NULL REFERENCES ciclo(id),
 estado text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','anulada')), consentimiento_id uuid NOT NULL REFERENCES consentimiento(id),
 edad_al_inicio smallint NOT NULL, edad_fuera_rango_confirmada boolean NOT NULL, duplicado_descartado boolean NOT NULL DEFAULT false,
 desde timestamptz NOT NULL DEFAULT clock_timestamp(), hasta timestamptz, anulada_en timestamptz, anulada_por uuid REFERENCES cuenta(id), motivo_anulacion text,
 huella_peticion text NOT NULL, CHECK (hasta IS NULL OR hasta >= desde),
 CHECK (edad_al_inicio BETWEEN 8 AND 13 OR edad_fuera_rango_confirmada),
 CHECK (estado <> 'anulada' OR (anulada_en IS NOT NULL AND motivo_anulacion IS NOT NULL AND length(trim(motivo_anulacion))>0))
);
CREATE UNIQUE INDEX inscripcion_vigente ON inscripcion(catequizando_id,ciclo_id) WHERE estado='vigente';
CREATE TABLE asignacion_grupo (
 id uuid PRIMARY KEY, inscripcion_id uuid NOT NULL REFERENCES inscripcion(id), grupo_id uuid NOT NULL REFERENCES grupo(id),
 desde timestamptz NOT NULL DEFAULT clock_timestamp(), hasta timestamptz, asignado_por uuid NOT NULL REFERENCES cuenta(id),
 fuera_de_sugerencia boolean NOT NULL, motivo text, CHECK (hasta IS NULL OR hasta >= desde)
);
CREATE UNIQUE INDEX asignacion_grupo_vigente ON asignacion_grupo(inscripcion_id) WHERE hasta IS NULL;
CREATE FUNCTION asignacion_validar_ciclo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ciclo_inscripcion uuid; ciclo_grupo uuid; estado_grupo text;
BEGIN
 SELECT ciclo_id INTO ciclo_inscripcion FROM inscripcion WHERE id=NEW.inscripcion_id;
 SELECT ciclo_id, estado INTO ciclo_grupo, estado_grupo FROM grupo WHERE id=NEW.grupo_id FOR UPDATE;
 IF ciclo_inscripcion IS DISTINCT FROM ciclo_grupo OR (TG_OP='INSERT' AND estado_grupo <> 'abierto') THEN RAISE EXCEPTION 'grupo_fuera_de_ciclo'; END IF;
 IF EXISTS (SELECT 1 FROM ciclo WHERE id=ciclo_inscripcion AND estado='cerrado') AND NOT (current_user='sigecat_retencion' AND COALESCE(current_setting('sigecat.contexto',true),'') IN ('retiro_consentimiento','retencion')) THEN RAISE EXCEPTION 'ciclo_cerrado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asignacion_mismo_ciclo BEFORE INSERT OR UPDATE ON asignacion_grupo FOR EACH ROW EXECUTE FUNCTION asignacion_validar_ciclo();
CREATE TRIGGER inscripcion_ciclo_abierto BEFORE INSERT OR UPDATE OR DELETE ON inscripcion FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT, INSERT, UPDATE, DELETE ON inscripcion, asignacion_grupo TO sigecat_api, sigecat_retencion;
