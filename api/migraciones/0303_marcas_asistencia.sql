CREATE FUNCTION asistencia_historia_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user='sigecat_retencion' AND current_setting('sigecat.contexto',true) IN ('retiro_consentimiento','retencion') THEN RETURN COALESCE(NEW,OLD); END IF;
 RAISE EXCEPTION 'historia_inmutable' USING ERRCODE='42501';
END $$;
CREATE TABLE lista_asistencia (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), sesion_id uuid NOT NULL, grupo_id uuid,
 confirmada_por uuid REFERENCES cuenta(id), cuenta_id uuid REFERENCES cuenta(id), credencial_id uuid REFERENCES credencial(id), dispositivo_id uuid,
 abierta_en timestamptz NOT NULL, confirmada_en timestamptz NOT NULL, desfase_reloj_ms bigint NOT NULL,
 recibido_en timestamptz NOT NULL DEFAULT clock_timestamp(), total_presentes integer NOT NULL CHECK(total_presentes>=0), total_ausentes integer NOT NULL CHECK(total_ausentes>=0),
 estado text NOT NULL CHECK(estado IN ('aceptada','rechazada')), motivo_rechazo text, huella_peticion text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz
);
CREATE TABLE marca_asistencia (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), sesion_id uuid NOT NULL, catequizando_id uuid REFERENCES catequizando(id),
 codigo_leido varchar(200), valor text NOT NULL CHECK(valor IN ('presente','ausente')), tipo_registro text NOT NULL CHECK(tipo_registro IN ('escaneo','manual','lista')),
 lista_id uuid, registrado_por uuid REFERENCES cuenta(id), cuenta_id uuid REFERENCES cuenta(id), credencial_id uuid REFERENCES credencial(id), dispositivo_id uuid,
 hora_dispositivo timestamptz NOT NULL, desfase_reloj_ms bigint NOT NULL, recibido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 estado text NOT NULL CHECK(estado IN ('aceptada','rechazada')), motivo_rechazo text, huella_peticion text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz
);
CREATE INDEX marca_asistencia_par ON marca_asistencia(sesion_id,catequizando_id);
CREATE INDEX marca_asistencia_autor ON marca_asistencia(cuenta_id,actualizado_en);
CREATE INDEX lista_asistencia_sesion_grupo ON lista_asistencia(sesion_id,grupo_id);
CREATE TRIGGER marca_inmutable BEFORE UPDATE OR DELETE ON marca_asistencia FOR EACH ROW EXECUTE FUNCTION asistencia_historia_inmutable();
CREATE TRIGGER lista_inmutable BEFORE UPDATE OR DELETE ON lista_asistencia FOR EACH ROW EXECUTE FUNCTION asistencia_historia_inmutable();
CREATE TRIGGER marca_ciclo BEFORE INSERT OR UPDATE OR DELETE ON marca_asistencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
CREATE TRIGGER lista_ciclo BEFORE INSERT OR UPDATE OR DELETE ON lista_asistencia FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
CREATE TRIGGER marca_sello BEFORE INSERT OR UPDATE ON marca_asistencia FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER lista_sello BEFORE INSERT OR UPDATE ON lista_asistencia FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
GRANT SELECT,INSERT ON lista_asistencia,marca_asistencia TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON lista_asistencia,marca_asistencia TO sigecat_retencion;
