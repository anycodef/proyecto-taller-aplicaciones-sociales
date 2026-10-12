ALTER TABLE asistencia ALTER COLUMN catequizando_id DROP NOT NULL;
ALTER TABLE asistencia ADD COLUMN estadistico_id uuid;
ALTER TABLE marca_asistencia ADD COLUMN estadistico_id uuid;
ALTER TABLE correccion_asistencia ADD COLUMN estadistico_id uuid;
ALTER TABLE aviso_asistencia ADD COLUMN estadistico_id uuid;
ALTER TABLE evento_asistencia ADD COLUMN estadistico_id uuid;
CREATE UNIQUE INDEX asistencia_estadistica ON asistencia(sesion_id,estadistico_id) WHERE estadistico_id IS NOT NULL;
