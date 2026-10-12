CREATE TABLE aviso_grupo (
 id uuid PRIMARY KEY, grupo_id uuid NOT NULL, autor_id uuid NOT NULL REFERENCES cuenta(id),
 texto text NOT NULL CHECK(length(trim(texto)) BETWEEN 1 AND 500), publicado_en timestamptz NOT NULL DEFAULT now(),
 retirado_en timestamptz, actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aviso_grupo_sync ON aviso_grupo(actualizado_en);
CREATE FUNCTION actualizar_aviso_grupo() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN NEW.actualizado_en=clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER aviso_grupo_actualizacion BEFORE UPDATE ON aviso_grupo FOR EACH ROW EXECUTE FUNCTION actualizar_aviso_grupo();
GRANT SELECT,INSERT,UPDATE ON aviso_grupo TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON aviso_grupo TO sigecat_retencion;
