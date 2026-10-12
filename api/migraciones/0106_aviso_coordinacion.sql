CREATE TABLE aviso_coordinacion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo text NOT NULL CHECK(tipo='pendientes_rechazados'),
 cuenta_relacionada_id uuid NOT NULL REFERENCES cuenta(id), cantidad integer NOT NULL CHECK(cantidad>0),
 creado_en timestamptz NOT NULL DEFAULT now(), leido_en timestamptz, leido_por uuid REFERENCES cuenta(id),
 credencial_relacionada_id uuid REFERENCES credencial(id),
 UNIQUE(credencial_relacionada_id,tipo,cantidad)
);
GRANT SELECT,INSERT,UPDATE ON aviso_coordinacion TO sigecat_api,sigecat_retencion;
