ALTER TABLE correccion_asistencia DROP CONSTRAINT correccion_asistencia_valor_anterior_check;
ALTER TABLE correccion_asistencia ADD CONSTRAINT correccion_asistencia_valor_anterior_check
 CHECK(valor_anterior IN ('presente','ausente','sin_registro'));
