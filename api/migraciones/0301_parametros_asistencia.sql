CREATE TABLE parametros_asistencia_ciclo (
 ciclo_id uuid PRIMARY KEY REFERENCES ciclo(id), zona_horaria text NOT NULL DEFAULT 'America/Lima' CHECK(zona_horaria='America/Lima'),
 ventana_misa_inicio time NOT NULL DEFAULT '07:30', ventana_misa_fin time NOT NULL DEFAULT '09:30',
 hora_fin_domingo time NOT NULL DEFAULT '23:59:59', tolerancia_reloj_min integer NOT NULL DEFAULT 10 CHECK(tolerancia_reloj_min BETWEEN 0 AND 10),
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(), eliminado_en timestamptz,
 CHECK(ventana_misa_fin>ventana_misa_inicio)
);
CREATE TRIGGER parametros_sello BEFORE INSERT OR UPDATE ON parametros_asistencia_ciclo FOR EACH ROW EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER parametros_ciclo BEFORE INSERT OR UPDATE OR DELETE ON parametros_asistencia_ciclo FOR EACH ROW EXECUTE FUNCTION ciclo_bloquear_si_cerrado();
GRANT SELECT,INSERT,UPDATE ON parametros_asistencia_ciclo TO sigecat_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON parametros_asistencia_ciclo TO sigecat_retencion;
