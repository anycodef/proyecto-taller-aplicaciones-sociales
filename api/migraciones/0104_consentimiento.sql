CREATE TABLE texto_consentimiento (
 id uuid PRIMARY KEY, version text NOT NULL UNIQUE, contenido text NOT NULL, contenido_sha256 bytea NOT NULL CHECK(octet_length(contenido_sha256)=32),
 vigente_desde timestamptz NOT NULL, incluye_clausula_constancia boolean NOT NULL CHECK(incluye_clausula_constancia)
);
CREATE TRIGGER texto_inmutable BEFORE UPDATE OR DELETE ON texto_consentimiento FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_inmutable();
INSERT INTO texto_consentimiento VALUES('00100000-0000-4000-8000-000000000001','1',
 'Autorizo el tratamiento de los datos necesarios para la catequesis: identidad, contacto del apoderado, asistencia, avance, estados documentales y condiciones necesarias para acompañar al niño. Coordinación y catequistas asignados acceden según sus funciones; la familia ve solo a sus hijos y supervisión consulta asistencia y evidencias. Puedo retirar el consentimiento: se borran los datos personales y evidencias y se conserva asistencia anonimizada. A los dos años del cierre se anonimizan los datos personales. La constancia sacramental se conserva sin vencimiento.',
 sha256(convert_to('Autorizo el tratamiento de los datos necesarios para la catequesis: identidad, contacto del apoderado, asistencia, avance, estados documentales y condiciones necesarias para acompañar al niño. Coordinación y catequistas asignados acceden según sus funciones; la familia ve solo a sus hijos y supervisión consulta asistencia y evidencias. Puedo retirar el consentimiento: se borran los datos personales y evidencias y se conserva asistencia anonimizada. A los dos años del cierre se anonimizan los datos personales. La constancia sacramental se conserva sin vencimiento.','UTF8')), '2026-10-11T00:00:00Z',true);
CREATE TABLE consentimiento (
 id uuid PRIMARY KEY, catequizando_id uuid NOT NULL, apoderado_id uuid NOT NULL, texto_id uuid NOT NULL REFERENCES texto_consentimiento(id),
 otorgado_en timestamptz NOT NULL DEFAULT now(), canal text NOT NULL CHECK(canal IN ('presencial','enlace')),
 registrado_por uuid NOT NULL REFERENCES cuenta(id), retirado_en timestamptz, retirado_por uuid REFERENCES cuenta(id),
 canal_retiro text CHECK(canal_retiro IN ('presencial','enlace'))
);
CREATE INDEX consentimiento_nino ON consentimiento(catequizando_id);
GRANT SELECT,INSERT ON texto_consentimiento TO sigecat_api;
GRANT SELECT,INSERT,UPDATE ON consentimiento TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON texto_consentimiento,consentimiento TO sigecat_retencion;
