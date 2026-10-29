-- Migración 0001 del esquema de demostración demo_tarea3 (spec 009, plan §4).
-- Es reejecutable: borra y vuelve a crear el esquema sin error, por lo que
-- `bd:subir` puede correrse cuantas veces se necesite.
-- No guarda salud, neurodivergencia ni documentos (RF-907, constitución 7).

DROP SCHEMA IF EXISTS demo_tarea3 CASCADE;
CREATE SCHEMA demo_tarea3;

CREATE TABLE demo_tarea3.grupo (
  id uuid PRIMARY KEY,
  nombre text NOT NULL
);

CREATE TABLE demo_tarea3.catequizando (
  id uuid PRIMARY KEY,
  grupo_id uuid NOT NULL REFERENCES demo_tarea3.grupo(id),
  identidad_operativa text NOT NULL,
  edad integer NOT NULL CHECK (edad BETWEEN 6 AND 15)
);

CREATE TABLE demo_tarea3.asistencia (
  id uuid PRIMARY KEY, -- UUID generado por el cliente (constitución 6, RF-905)
  catequizando_id uuid NOT NULL REFERENCES demo_tarea3.catequizando(id),
  fecha date NOT NULL,
  estado text NOT NULL CHECK (estado IN ('PRESENTE','AUSENTE','JUSTIFICADA','TARDANZA')),
  registrado_por text NOT NULL, -- siempre identidadOperativa (RF-907)
  registrado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE demo_tarea3.justificacion (
  id uuid PRIMARY KEY,
  asistencia_id uuid NOT NULL REFERENCES demo_tarea3.asistencia(id),
  motivo text NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA'))
);

CREATE TABLE demo_tarea3.riesgo (
  catequizando_id uuid PRIMARY KEY REFERENCES demo_tarea3.catequizando(id),
  nivel text NOT NULL CHECK (nivel IN ('BAJO','MEDIO','ALTO')),
  motivo text NOT NULL,
  calculado_en timestamptz NOT NULL DEFAULT now()
);
