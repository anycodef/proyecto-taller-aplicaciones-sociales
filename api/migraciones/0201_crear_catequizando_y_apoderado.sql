CREATE TABLE catequizando (
 id uuid PRIMARY KEY, nombres text NOT NULL, apellidos text NOT NULL, fecha_nacimiento date,
 sexo text NOT NULL CHECK (sexo IN ('femenino','masculino')), bautizado boolean NOT NULL,
 clave_duplicado text, estado text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','inactivo','anonimizado')),
 creado_por uuid NOT NULL REFERENCES cuenta(id), creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (estado='anonimizado' OR (fecha_nacimiento IS NOT NULL AND length(trim(nombres))>0 AND length(trim(apellidos))>0))
);
CREATE INDEX catequizando_duplicado ON catequizando(clave_duplicado) WHERE clave_duplicado IS NOT NULL;
CREATE TABLE apoderado (
 id uuid PRIMARY KEY, nombres text NOT NULL, apellidos text NOT NULL,
 tipo_contacto text NOT NULL CHECK (tipo_contacto IN ('telefono','otro')), valor_contacto text NOT NULL CHECK (length(trim(valor_contacto))>0),
 cuenta_id uuid UNIQUE REFERENCES cuenta(id)
);
CREATE TABLE vinculo_apoderado (
 id uuid PRIMARY KEY, catequizando_id uuid NOT NULL REFERENCES catequizando(id), apoderado_id uuid NOT NULL REFERENCES apoderado(id),
 relacion text NOT NULL CHECK (relacion IN ('madre','padre','otro_familiar','tutor')), detalle_relacion varchar(100),
 vigente_desde timestamptz NOT NULL DEFAULT clock_timestamp(), vigente_hasta timestamptz, desvinculado_por uuid REFERENCES cuenta(id),
 CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE UNIQUE INDEX vinculo_apoderado_vigente ON vinculo_apoderado(catequizando_id,apoderado_id) WHERE vigente_hasta IS NULL;
CREATE TABLE referencia_duplicado (
 id uuid PRIMARY KEY, cuenta_id uuid NOT NULL REFERENCES cuenta(id), catequizando_id uuid NOT NULL REFERENCES catequizando(id),
 clave_duplicado text NOT NULL, vence_en timestamptz NOT NULL, es_el_mismo boolean, confirmado_en timestamptz
);
CREATE TABLE contador_busqueda_apoderado (cuenta_id uuid PRIMARY KEY REFERENCES cuenta(id), ventana timestamptz NOT NULL, cantidad integer NOT NULL CHECK(cantidad>0));
GRANT SELECT, INSERT, UPDATE, DELETE ON contador_busqueda_apoderado TO sigecat_api, sigecat_retencion;
GRANT SELECT, INSERT, UPDATE, DELETE ON catequizando, apoderado, vinculo_apoderado, referencia_duplicado TO sigecat_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON catequizando, apoderado, vinculo_apoderado, referencia_duplicado TO sigecat_retencion;
