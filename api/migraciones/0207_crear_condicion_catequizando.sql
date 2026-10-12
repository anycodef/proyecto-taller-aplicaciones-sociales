CREATE TABLE condicion_catequizando (
 id uuid PRIMARY KEY, catequizando_id uuid NOT NULL REFERENCES catequizando(id),
 categoria text NOT NULL CHECK (categoria IN ('trastorno_espectro_autista','deficit_atencion_hiperactividad','discapacidad_fisica','discapacidad_intelectual','alergia','condicion_medica','otra')),
 nota varchar(200), registrado_por uuid NOT NULL REFERENCES cuenta(id), registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(catequizando_id,categoria)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON condicion_catequizando TO sigecat_api, sigecat_retencion;
