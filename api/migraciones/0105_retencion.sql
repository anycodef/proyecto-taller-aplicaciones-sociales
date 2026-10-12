CREATE TABLE ejecucion_retencion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo text NOT NULL CHECK(tipo IN ('retiro_consentimiento','vencimiento_ciclo')),
 objetivo_id uuid NOT NULL, iniciada_en timestamptz NOT NULL DEFAULT now(), completada_en timestamptz,
 resumen jsonb NOT NULL DEFAULT '{}', UNIQUE(tipo,objetivo_id)
);
CREATE TABLE borrado_blob_pendiente (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ejecucion_id uuid NOT NULL REFERENCES ejecucion_retencion(id),
 contenedor text NOT NULL, ruta text NOT NULL, intentos integer NOT NULL DEFAULT 0, ultimo_error text,
 creado_en timestamptz NOT NULL DEFAULT now(), completado_en timestamptz, UNIQUE(ejecucion_id,contenedor,ruta)
);
GRANT SELECT,INSERT,UPDATE ON ejecucion_retencion,borrado_blob_pendiente TO sigecat_api,sigecat_retencion;
