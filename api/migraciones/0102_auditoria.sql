CREATE TABLE evento_auditoria (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ocurrido_en timestamptz NOT NULL DEFAULT now(), cuenta_id uuid REFERENCES cuenta(id),
 credencial_id uuid REFERENCES credencial(id), delegacion_id uuid, accion text NOT NULL, recurso_tipo text,
 recurso_id uuid, catequizando_id uuid, resultado text NOT NULL CHECK(resultado IN ('permitido','denegado')), detalle jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX evento_auditoria_fecha ON evento_auditoria(ocurrido_en);
CREATE INDEX evento_auditoria_nino ON evento_auditoria(catequizando_id,ocurrido_en);
CREATE FUNCTION impedir_mutacion_inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_TABLE_NAME='evento_auditoria' AND TG_OP='DELETE' AND current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.evento_auditoria'::regclass)) AND current_setting('sigecat.purga_auditoria',true)='autorizada' THEN RETURN OLD; END IF;
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 RAISE EXCEPTION 'registro_inmutable' USING ERRCODE='42501';
END $$;
CREATE TRIGGER evento_inmutable BEFORE UPDATE OR DELETE ON evento_auditoria FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_inmutable();
CREATE FUNCTION purgar_auditoria(antes timestamptz) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE cantidad bigint;
BEGIN
 IF antes > now()-interval '730 days' THEN RAISE EXCEPTION 'retencion_auditoria_minima'; END IF;
 PERFORM set_config('sigecat.purga_auditoria','autorizada',true);
 DELETE FROM public.evento_auditoria WHERE ocurrido_en<antes;
 GET DIAGNOSTICS cantidad = ROW_COUNT;
 PERFORM set_config('sigecat.purga_auditoria','',true);
 RETURN cantidad;
END $$;
REVOKE ALL ON FUNCTION purgar_auditoria(timestamptz), impedir_mutacion_inmutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purgar_auditoria(timestamptz) TO sigecat_api;
GRANT SELECT,INSERT ON evento_auditoria TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON evento_auditoria TO sigecat_retencion;
