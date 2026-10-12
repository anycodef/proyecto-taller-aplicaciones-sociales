CREATE TABLE delegacion (
 id uuid PRIMARY KEY, delegante_id uuid NOT NULL REFERENCES cuenta(id), delegado_id uuid NOT NULL REFERENCES cuenta(id),
 desde timestamptz NOT NULL, hasta timestamptz NOT NULL, creada_en timestamptz NOT NULL DEFAULT now(),
 revocada_en timestamptz, revocada_por uuid REFERENCES cuenta(id), terminada_por_cierre boolean NOT NULL DEFAULT false,
 CHECK(hasta>desde), CHECK(delegante_id<>delegado_id)
);
CREATE INDEX delegacion_vigencia ON delegacion(delegado_id,desde,hasta);
ALTER TABLE evento_auditoria ADD CONSTRAINT evento_delegacion_fk FOREIGN KEY(delegacion_id) REFERENCES delegacion(id);
GRANT SELECT,INSERT,UPDATE,DELETE ON delegacion TO sigecat_api,sigecat_retencion;
