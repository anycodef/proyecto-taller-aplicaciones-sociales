CREATE TABLE cuenta (
 id uuid PRIMARY KEY, identidad_operativa text NOT NULL CHECK(length(trim(identidad_operativa)) BETWEEN 1 AND 150),
 es_menor boolean NOT NULL, activa boolean NOT NULL DEFAULT true,
 creada_por uuid REFERENCES cuenta(id), creada_en timestamptz NOT NULL DEFAULT now(),
 desactivada_en timestamptz, desactivada_por uuid REFERENCES cuenta(id)
);
CREATE UNIQUE INDEX cuenta_identidad_activa ON cuenta(lower(identidad_operativa)) WHERE activa;
CREATE TABLE rol_cuenta (
 cuenta_id uuid NOT NULL REFERENCES cuenta(id), rol text NOT NULL CHECK(rol IN ('administracion','coordinacion','catequista','familia','supervision')),
 asignado_por uuid REFERENCES cuenta(id), asignado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(cuenta_id,rol)
);
-- Una fila escrita serializa también desactivaciones concurrentes bajo READ COMMITTED y REPEATABLE READ.
CREATE TABLE guardia_administracion (id boolean PRIMARY KEY DEFAULT true CHECK(id), version bigint NOT NULL DEFAULT 0);
INSERT INTO guardia_administracion DEFAULT VALUES;
CREATE FUNCTION bloquear_administracion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN UPDATE public.guardia_administracion SET version=version+1 WHERE id; RETURN NULL; END $$;
CREATE TRIGGER cuenta_bloquear_administracion BEFORE UPDATE OR DELETE ON cuenta FOR EACH STATEMENT EXECUTE FUNCTION bloquear_administracion();
CREATE TRIGGER rol_bloquear_administracion BEFORE INSERT OR UPDATE OR DELETE ON rol_cuenta FOR EACH STATEMENT EXECUTE FUNCTION bloquear_administracion();
CREATE FUNCTION proteger_ultimo_administrador() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_TABLE_NAME='cuenta' THEN
  IF NOT OLD.activa OR NOT EXISTS(SELECT 1 FROM public.rol_cuenta WHERE cuenta_id=OLD.id AND rol='administracion') THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' THEN IF NEW.activa THEN RETURN NEW; END IF; END IF;
 ELSIF TG_TABLE_NAME='rol_cuenta' THEN
  IF OLD.rol <> 'administracion' THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' THEN IF NEW.rol='administracion' AND NEW.cuenta_id=OLD.cuenta_id THEN RETURN NEW; END IF; END IF;
 ELSE RETURN OLD;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cuenta c JOIN public.rol_cuenta r ON r.cuenta_id=c.id WHERE c.activa AND r.rol='administracion') THEN
  RAISE EXCEPTION 'ultimo_administrador' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER cuenta_ultimo_administrador AFTER UPDATE OR DELETE ON cuenta FOR EACH ROW EXECUTE FUNCTION proteger_ultimo_administrador();
CREATE TRIGGER rol_ultimo_administrador AFTER UPDATE OR DELETE ON rol_cuenta FOR EACH ROW EXECUTE FUNCTION proteger_ultimo_administrador();
CREATE TABLE identidad_real (cuenta_id uuid PRIMARY KEY REFERENCES cuenta(id), nombres text NOT NULL, apellidos text NOT NULL, fecha_nacimiento date);
CREATE TABLE credencial (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cuenta_id uuid NOT NULL REFERENCES cuenta(id),
 tipo text NOT NULL CHECK(tipo IN ('equipo','familia')), token_hash bytea NOT NULL UNIQUE CHECK(octet_length(token_hash)=32),
 estado text NOT NULL DEFAULT 'emitida' CHECK(estado IN ('emitida','activa','terminada')), dispositivo_id uuid,
 emitida_por uuid REFERENCES cuenta(id), emitida_en timestamptz NOT NULL DEFAULT now(), activada_en timestamptz,
 terminada_en timestamptz, terminada_por uuid REFERENCES cuenta(id),
 motivo_fin text CHECK(motivo_fin IN ('revocacion','reemision','bloqueo_pin','cuenta_desactivada','cierre_ciclo','sin_vinculos')),
 CHECK(tipo <> 'familia' OR dispositivo_id IS NULL)
);
CREATE UNIQUE INDEX credencial_vigente ON credencial(cuenta_id,tipo) WHERE estado <> 'terminada';
CREATE TABLE sesion_renovacion (
 credencial_id uuid PRIMARY KEY REFERENCES credencial(id), hash_actual bytea NOT NULL CHECK(octet_length(hash_actual)=32),
 hash_anterior bytea CHECK(octet_length(hash_anterior)=32), ultima_renovacion timestamptz NOT NULL, expira_en timestamptz NOT NULL
);
CREATE INDEX sesion_hash_actual ON sesion_renovacion(hash_actual);
CREATE INDEX sesion_hash_anterior ON sesion_renovacion(hash_anterior) WHERE hash_anterior IS NOT NULL;
CREATE FUNCTION leer_identidad_real(solicitante uuid, objetivo uuid) RETURNS TABLE(nombres text,apellidos text,fecha_nacimiento date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.rol_cuenta r JOIN public.cuenta c ON c.id=r.cuenta_id WHERE r.cuenta_id=solicitante AND c.activa AND r.rol='administracion') THEN RAISE EXCEPTION 'fuera_de_alcance' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT i.nombres,i.apellidos,i.fecha_nacimiento FROM public.identidad_real i WHERE i.cuenta_id=objetivo;
END $$;
CREATE FUNCTION guardar_identidad_real(solicitante uuid, objetivo uuid, nombres_nuevos text, apellidos_nuevos text, nacimiento date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE es_admin boolean; es_coord boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.rol_cuenta r JOIN public.cuenta c ON c.id=r.cuenta_id WHERE c.activa AND r.cuenta_id=solicitante AND r.rol='administracion'),
 EXISTS(SELECT 1 FROM public.cuenta c WHERE c.id=solicitante AND c.activa AND (EXISTS(SELECT 1 FROM public.rol_cuenta r WHERE r.cuenta_id=c.id AND r.rol='coordinacion') OR EXISTS(SELECT 1 FROM public.delegacion d JOIN public.cuenta delegante ON delegante.id=d.delegante_id WHERE d.delegado_id=c.id AND d.revocada_en IS NULL AND d.desde<=now() AND d.hasta>now() AND delegante.activa AND EXISTS(SELECT 1 FROM public.rol_cuenta r WHERE r.cuenta_id=delegante.id AND r.rol IN ('administracion','coordinacion')) AND EXISTS(SELECT 1 FROM public.rol_cuenta r WHERE r.cuenta_id=c.id AND r.rol='catequista')))) INTO es_admin,es_coord;
 IF NOT es_admin AND (NOT es_coord OR EXISTS(SELECT 1 FROM public.rol_cuenta WHERE cuenta_id=objetivo AND rol NOT IN ('catequista','familia')) OR NOT EXISTS(SELECT 1 FROM public.rol_cuenta WHERE cuenta_id=objetivo)) THEN RAISE EXCEPTION 'fuera_de_alcance' USING ERRCODE='42501'; END IF;
 INSERT INTO public.identidad_real VALUES(objetivo,nombres_nuevos,apellidos_nuevos,nacimiento) ON CONFLICT(cuenta_id) DO UPDATE SET nombres=EXCLUDED.nombres,apellidos=EXCLUDED.apellidos,fecha_nacimiento=EXCLUDED.fecha_nacimiento;
END $$;
REVOKE ALL ON FUNCTION leer_identidad_real(uuid,uuid), guardar_identidad_real(uuid,uuid,text,text,date), bloquear_administracion(), proteger_ultimo_administrador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leer_identidad_real(uuid,uuid), guardar_identidad_real(uuid,uuid,text,text,date) TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON cuenta,rol_cuenta,credencial,sesion_renovacion TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON cuenta,rol_cuenta,credencial,sesion_renovacion,identidad_real TO sigecat_retencion;
