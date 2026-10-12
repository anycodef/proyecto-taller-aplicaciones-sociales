CREATE TABLE grupo (
 id uuid PRIMARY KEY, ciclo_id uuid NOT NULL REFERENCES ciclo(id), nombre text NOT NULL CHECK (length(trim(nombre))>0),
 edad_minima smallint NOT NULL CHECK (edad_minima >= 0), edad_maxima smallint NOT NULL CHECK (edad_maxima <= 120),
 modalidad text NOT NULL CHECK (modalidad IN ('mixto','femenino','masculino')),
 estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')), cerrado_en timestamptz,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz, CHECK (edad_minima <= edad_maxima)
);
CREATE UNIQUE INDEX grupo_nombre_abierto ON grupo(ciclo_id,lower(nombre)) WHERE estado='abierto';
CREATE TABLE grupo_catequista (
 id uuid PRIMARY KEY, grupo_id uuid NOT NULL REFERENCES grupo(id), cuenta_id uuid NOT NULL REFERENCES cuenta(id),
 desde timestamptz NOT NULL DEFAULT clock_timestamp(), hasta timestamptz, CHECK (hasta IS NULL OR hasta >= desde)
);
CREATE UNIQUE INDEX grupo_catequista_vigente ON grupo_catequista(grupo_id,cuenta_id) WHERE hasta IS NULL;
CREATE TRIGGER grupo_ciclo_abierto BEFORE INSERT OR UPDATE OR DELETE ON grupo FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT, INSERT, UPDATE, DELETE ON grupo, grupo_catequista TO sigecat_api, sigecat_retencion;
