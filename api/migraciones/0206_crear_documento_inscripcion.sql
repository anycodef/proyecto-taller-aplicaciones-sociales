CREATE TABLE documento_inscripcion (
 id uuid PRIMARY KEY, inscripcion_id uuid NOT NULL REFERENCES inscripcion(id),
 tipo text NOT NULL CHECK (tipo IN ('documento_identidad','partida_nacimiento','partida_bautismo','boleta_pago','ficha_compromiso')),
 estado text NOT NULL CHECK (estado IN ('pendiente','entregado','invalido','no_aplica')), motivo text, fecha_estado date NOT NULL,
 recibido_por uuid REFERENCES cuenta(id), UNIQUE(inscripcion_id,tipo), CHECK (estado<>'invalido' OR (motivo IS NOT NULL AND length(trim(motivo))>0))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON documento_inscripcion TO sigecat_api, sigecat_retencion;
