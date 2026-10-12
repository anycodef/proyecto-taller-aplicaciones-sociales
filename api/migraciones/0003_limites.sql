CREATE TABLE contador_limite(cuenta_id uuid NOT NULL,operacion text NOT NULL,ventana bigint NOT NULL,cantidad integer NOT NULL,PRIMARY KEY(cuenta_id,operacion,ventana));
GRANT SELECT,INSERT,UPDATE,DELETE ON contador_limite TO sigecat_api;
