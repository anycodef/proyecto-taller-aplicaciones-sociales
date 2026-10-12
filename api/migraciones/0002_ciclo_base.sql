CREATE TABLE ciclo (
 id uuid PRIMARY KEY, nombre text NOT NULL CHECK(length(trim(nombre)) BETWEEN 1 AND 150),
 inicio date NOT NULL, fin date NOT NULL CHECK(fin>inicio), estado text NOT NULL DEFAULT 'abierto' CHECK(estado IN ('abierto','cerrado')),
 abierto_por uuid NOT NULL, abierto_en timestamptz NOT NULL DEFAULT now(), cerrado_por uuid, cerrado_en timestamptz, depurado_en timestamptz
);
CREATE UNIQUE INDEX ciclo_un_abierto ON ciclo(estado) WHERE estado='abierto';
CREATE FUNCTION ciclo_bloquear_si_cerrado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identificador uuid;
BEGIN
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retencion','retiro_consentimiento') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' THEN identificador=OLD.ciclo_id; ELSE identificador=NEW.ciclo_id; END IF;
 PERFORM 1 FROM ciclo WHERE id=identificador AND estado='abierto' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ciclo_cerrado' USING ERRCODE='SG801'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE FUNCTION ciclo_transicion_valida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retencion','retiro_consentimiento') THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' OR (OLD.estado='cerrado' AND (to_jsonb(OLD)-'depurado_en') IS DISTINCT FROM (to_jsonb(NEW)-'depurado_en')) THEN RAISE EXCEPTION 'ciclo_cerrado' USING ERRCODE='SG801'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ciclo_transicion BEFORE UPDATE OR DELETE ON ciclo FOR EACH ROW EXECUTE FUNCTION ciclo_transicion_valida();
GRANT SELECT,INSERT,UPDATE ON ciclo TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON ciclo TO sigecat_retencion;
