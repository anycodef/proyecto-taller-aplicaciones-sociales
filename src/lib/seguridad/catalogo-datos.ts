export type EntradaCatalogo = Readonly<{ entidad: string; campo: string; clasificacion: "operativo" | "restringido" | "identidad-equipo"; finalidad: "formar-grupos" | "aptitud" | "operacion" | "contacto" }>;
export type CampoEsquema = Readonly<{ entidad: string; campo: string }>;
type GrupoCatalogo = readonly [string, EntradaCatalogo["clasificacion"], EntradaCatalogo["finalidad"], readonly string[]];

const grupos: readonly GrupoCatalogo[] = [
  ["cuenta", "operativo", "operacion", ["identidad_operativa", "es_menor", "activa"]],
  ["identidad_real", "identidad-equipo", "operacion", ["nombres", "apellidos", "fecha_nacimiento"]],
  ["rol_cuenta", "operativo", "operacion", ["rol"]],
  ["credencial", "identidad-equipo", "operacion", ["token_hash"]],
  ["credencial", "operativo", "operacion", ["tipo", "estado", "motivo_fin"]],
  ["sesion_renovacion", "identidad-equipo", "operacion", ["hash_actual", "hash_anterior"]],
  ["evento_auditoria", "operativo", "operacion", ["accion", "recurso_tipo", "resultado", "detalle"]],
  ["delegacion", "operativo", "operacion", ["terminada_por_cierre"]],
  ["texto_consentimiento", "operativo", "operacion", ["version", "contenido", "incluye_clausula_constancia"]],
  ["consentimiento", "operativo", "operacion", ["canal", "canal_retiro"]],
  ["ejecucion_retencion", "operativo", "operacion", ["tipo", "resumen"]],
  ["borrado_blob_pendiente", "restringido", "operacion", ["contenedor", "ruta"]],
  ["borrado_blob_pendiente", "operativo", "operacion", ["ultimo_error"]],
  ["aviso_coordinacion", "operativo", "operacion", ["tipo", "cantidad"]],
  ["aviso_grupo", "operativo", "operacion", ["texto"]],
  ["catequizando", "operativo", "formar-grupos", ["nombres", "apellidos", "fecha_nacimiento", "sexo", "clave_duplicado"]],
  ["catequizando", "operativo", "aptitud", ["bautizado"]],
  ["catequizando", "operativo", "operacion", ["estado"]],
  ["apoderado", "operativo", "contacto", ["nombres", "apellidos", "tipo_contacto", "valor_contacto"]],
  ["vinculo_apoderado", "operativo", "contacto", ["relacion", "detalle_relacion"]],
  ["referencia_duplicado", "operativo", "formar-grupos", ["clave_duplicado", "es_el_mismo"]],
  ["grupo", "operativo", "formar-grupos", ["nombre", "edad_minima", "edad_maxima", "modalidad"]],
  ["grupo", "operativo", "operacion", ["estado"]],
  ["inscripcion", "operativo", "formar-grupos", ["edad_al_inicio", "edad_fuera_rango_confirmada", "duplicado_descartado"]],
  ["inscripcion", "operativo", "operacion", ["estado", "motivo_anulacion"]],
  ["asignacion_grupo", "operativo", "formar-grupos", ["fuera_de_sugerencia", "motivo"]],
  ["carne_emision", "operativo", "operacion", ["emision"]],
  ["cambio_inscripcion", "operativo", "operacion", ["entidad", "campo"]],
  ["cambio_inscripcion", "restringido", "operacion", ["valor_anterior", "valor_nuevo", "motivo"]],
  ["documento_inscripcion", "operativo", "aptitud", ["tipo", "estado", "motivo", "fecha_estado"]],
  ["condicion_catequizando", "restringido", "aptitud", ["categoria", "nota"]],
  ["ciclo", "operativo", "operacion", ["nombre", "inicio", "fin", "estado"]],
  ["parametros_asistencia_ciclo", "operativo", "operacion", ["zona_horaria", "ventana_misa_inicio", "ventana_misa_fin", "hora_fin_domingo", "tolerancia_reloj_min"]],
  ["sesion", "operativo", "operacion", ["fecha", "tipo", "ventana_inicio", "ventana_fin", "cancelada", "motivo_cancelacion"]],
  ["lista_asistencia", "operativo", "operacion", ["total_presentes", "total_ausentes", "estado", "motivo_rechazo"]],
  ["marca_asistencia", "operativo", "operacion", ["codigo_leido", "valor", "tipo_registro", "estado", "motivo_rechazo"]],
  ["asistencia", "operativo", "operacion", ["valor", "tipo_registro", "corregida", "conflicto"]],
  ["correccion_asistencia", "operativo", "operacion", ["valor_anterior", "valor_nuevo", "motivo", "estado", "motivo_rechazo"]],
  ["aviso_asistencia", "operativo", "operacion", ["tipo", "detalle", "estado"]],
  ["evento_asistencia", "operativo", "operacion", ["tipo", "fecha"]],
  ["actividad_obligatoria", "operativo", "operacion", ["nombre", "tipo", "fecha", "estado"]],
  ["cambio_actividad", "operativo", "operacion", ["campo", "valor_anterior", "valor_nuevo"]],
];

export const CATALOGO: readonly EntradaCatalogo[] = Object.freeze(grupos.flatMap(([entidad, clasificacion, finalidad, campos]) => campos.map(campo => Object.freeze({ entidad, campo, clasificacion, finalidad }))));

function listasCerradas(listas: Record<string, readonly string[]>): Readonly<Record<string, readonly string[]>> {
  return Object.freeze(Object.fromEntries(Object.entries(listas).map(([entidad, campos]) => [entidad, Object.freeze([...campos])])));
}

// Se enumeran por tabla: ni el tipo SQL ni un sufijo convierten una columna nueva en técnica.
export const COLUMNAS_TECNICAS = listasCerradas({
  cuenta: ["id", "creada_por", "creada_en", "desactivada_en", "desactivada_por"],
  identidad_real: ["cuenta_id"],
  rol_cuenta: ["cuenta_id", "asignado_por", "asignado_en"],
  guardia_administracion: ["id", "version"],
  credencial: ["id", "cuenta_id", "dispositivo_id", "emitida_por", "emitida_en", "activada_en", "terminada_en", "terminada_por"],
  sesion_renovacion: ["credencial_id", "ultima_renovacion", "expira_en"],
  evento_auditoria: ["id", "ocurrido_en", "cuenta_id", "credencial_id", "delegacion_id", "recurso_id", "catequizando_id"],
  delegacion: ["id", "delegante_id", "delegado_id", "desde", "hasta", "creada_en", "revocada_en", "revocada_por"],
  texto_consentimiento: ["id", "contenido_sha256", "vigente_desde"],
  consentimiento: ["id", "catequizando_id", "apoderado_id", "texto_id", "otorgado_en", "registrado_por", "retirado_en", "retirado_por"],
  ejecucion_retencion: ["id", "objetivo_id", "iniciada_en", "completada_en"],
  borrado_blob_pendiente: ["id", "ejecucion_id", "intentos", "creado_en", "completado_en"],
  aviso_coordinacion: ["id", "cuenta_relacionada_id", "creado_en", "leido_en", "leido_por", "credencial_relacionada_id"],
  aviso_grupo: ["id", "grupo_id", "autor_id", "publicado_en", "retirado_en", "actualizado_en"],
  catequizando: ["id", "creado_por", "creado_en", "actualizado_en", "eliminado_en"],
  apoderado: ["id", "cuenta_id"],
  vinculo_apoderado: ["id", "catequizando_id", "apoderado_id", "vigente_desde", "vigente_hasta", "desvinculado_por"],
  referencia_duplicado: ["id", "cuenta_id", "catequizando_id", "vence_en", "confirmado_en"],
  grupo: ["id", "ciclo_id", "cerrado_en", "actualizado_en", "eliminado_en"],
  grupo_catequista: ["id", "grupo_id", "cuenta_id", "desde", "hasta"],
  inscripcion: ["id", "catequizando_id", "ciclo_id", "consentimiento_id", "desde", "hasta", "anulada_en", "anulada_por", "huella_peticion"],
  asignacion_grupo: ["id", "inscripcion_id", "grupo_id", "desde", "hasta", "asignado_por"],
  carne_emision: ["catequizando_id", "emitida_en", "emitida_por", "invalidada_en"],
  cambio_inscripcion: ["id", "catequizando_id", "entidad_id", "cambiado_por", "cambiado_en"],
  documento_inscripcion: ["id", "inscripcion_id", "recibido_por"],
  condicion_catequizando: ["id", "catequizando_id", "registrado_por", "registrado_en"],
  ciclo: ["id", "abierto_por", "abierto_en", "cerrado_por", "cerrado_en", "depurado_en"],
  parametros_asistencia_ciclo: ["ciclo_id", "actualizado_en", "eliminado_en"],
  sesion: ["id", "ciclo_id", "actividad_id", "actualizado_por", "cuenta_id", "credencial_id", "dispositivo_id", "actualizado_en", "eliminado_en"],
  lista_asistencia: ["id", "ciclo_id", "sesion_id", "grupo_id", "confirmada_por", "cuenta_id", "credencial_id", "dispositivo_id", "abierta_en", "confirmada_en", "desfase_reloj_ms", "recibido_en", "huella_peticion", "actualizado_en", "eliminado_en"],
  marca_asistencia: ["id", "ciclo_id", "sesion_id", "catequizando_id", "lista_id", "registrado_por", "cuenta_id", "credencial_id", "dispositivo_id", "hora_dispositivo", "desfase_reloj_ms", "recibido_en", "huella_peticion", "actualizado_en", "eliminado_en", "estadistico_id"],
  asistencia: ["id", "ciclo_id", "sesion_id", "catequizando_id", "hora_primer_registro", "recibido_primer_registro", "actualizado_en", "eliminado_en", "estadistico_id"],
  correccion_asistencia: ["id", "ciclo_id", "sesion_id", "catequizando_id", "corregido_por", "cuenta_id", "credencial_id", "dispositivo_id", "hora_dispositivo", "desfase_reloj_ms", "recibido_en", "huella_peticion", "actualizado_en", "eliminado_en", "estadistico_id"],
  aviso_asistencia: ["id", "ciclo_id", "sesion_id", "catequizando_id", "marca_id", "atendido_por", "atendido_en", "actualizado_en", "eliminado_en", "estadistico_id"],
  evento_asistencia: ["secuencia", "ciclo_id", "catequizando_id", "creado_en", "estadistico_id"],
  actividad_obligatoria: ["id", "ciclo_id", "creado_por", "actualizado_en", "eliminado_en", "cuenta_id", "credencial_id", "dispositivo_id", "huella_creacion"],
  cambio_actividad: ["id", "ciclo_id", "actividad_id", "cambiado_por", "cambiado_en"],
  contador_limite: ["cuenta_id", "operacion", "ventana", "cantidad"],
  contador_busqueda_apoderado: ["cuenta_id", "ventana", "cantidad"],
  bitacora_sincronizacion: ["id", "cuenta_id", "dispositivo_id", "operacion", "recibido_en", "duracion_ms", "bytes_entrada", "bytes_salida", "aceptados", "rechazados", "descartados_cierre", "version_esquema"],
  lapida_sincronizacion: ["tabla", "fila_id", "cuenta_id", "ciclo_id", "eliminado_en"],
});

export const TABLAS_INFRAESTRUCTURA: readonly string[] = Object.freeze(["esquema_migracion"]);

export function registrarDatos(entradas: readonly EntradaCatalogo[], base: readonly EntradaCatalogo[] = CATALOGO): readonly EntradaCatalogo[] {
  const copia = base.map(entrada => Object.freeze({ ...entrada }));
  for (const entrada of entradas) {
    const anterior = copia.find(e => e.entidad === entrada.entidad && e.campo === entrada.campo);
    if (anterior && (anterior.clasificacion !== entrada.clasificacion || anterior.finalidad !== entrada.finalidad)) throw new Error("clasificacion_dato_incompatible");
    if (!anterior) copia.push(Object.freeze({ ...entrada }));
  }
  return Object.freeze(copia);
}
export const esCampoRestringido = (entidad: string, campo: string): boolean => CATALOGO.some(e => e.entidad === entidad && e.campo === campo && e.clasificacion !== "operativo");
// Compatibilidad para consumidores antiguos; la validación local siempre compara entidad y campo.
export const camposRestringidos = (): string[] => [...new Set(CATALOGO.filter(e => e.clasificacion !== "operativo").map(e => e.campo))];
export function camposSinCatalogar(columnas: readonly CampoEsquema[]): CampoEsquema[] {
  return columnas.filter(({ entidad, campo }) => !TABLAS_INFRAESTRUCTURA.includes(entidad)
    && !CATALOGO.some(e => e.entidad === entidad && e.campo === campo)
    && !(Object.hasOwn(COLUMNAS_TECNICAS, entidad) && COLUMNAS_TECNICAS[entidad]!.includes(campo)));
}
export function validarCoberturaCatalogo(columnas: readonly CampoEsquema[]): void {
  const faltantes = camposSinCatalogar(columnas);
  if (faltantes.length) throw new Error(`campos_sin_catalogar:${faltantes.map(e => `${e.entidad}.${e.campo}`).sort().join(",")}`);
}

type ProyeccionLocal = Readonly<Record<string, CampoEsquema>>;
function proyeccion(entidad: string, campos: readonly string[], derivados: Record<string, CampoEsquema> = {}): ProyeccionLocal {
  return Object.freeze(Object.fromEntries([...campos.map(campo => [campo, Object.freeze({ entidad, campo })] as const), ...Object.entries(derivados).map(([campo, fuente]) => [campo, Object.freeze({ ...fuente })] as const)]));
}
const autoria = ["cuenta_id", "credencial_id", "dispositivo_id"] as const;
const sesion = ["id", "ciclo_id", "sesion_id"] as const;
// Operativo no significa persistible: solo estas proyecciones mínimas pueden llegar al almacén local.
export const PROYECCIONES_LOCALES: Readonly<Record<string, ProyeccionLocal>> = Object.freeze({
  catequizandos: proyeccion("catequizando", ["id", "nombres", "apellidos"], { grupo_id: { entidad: "asignacion_grupo", campo: "grupo_id" }, codigo_carne: { entidad: "carne_emision", campo: "emision" }, activo: { entidad: "catequizando", campo: "estado" } }),
  grupos: proyeccion("grupo", ["id", "nombre", "ciclo_id", "estado"], { es_mio: { entidad: "grupo_catequista", campo: "cuenta_id" } }),
  parametros_asistencia: proyeccion("parametros_asistencia_ciclo", ["ciclo_id", "zona_horaria", "ventana_misa_inicio", "ventana_misa_fin", "hora_fin_domingo", "tolerancia_reloj_min"], { id: { entidad: "parametros_asistencia_ciclo", campo: "ciclo_id" } }),
  sesiones: proyeccion("sesion", ["id", "ciclo_id", "fecha", "tipo", "actividad_id", "ventana_inicio", "ventana_fin", "cancelada", "motivo_cancelacion", "actualizado_por", ...autoria]),
  listas_asistencia: proyeccion("lista_asistencia", [...sesion, "grupo_id", "confirmada_por", "abierta_en", "confirmada_en", "desfase_reloj_ms", "recibido_en", "total_presentes", "total_ausentes", "estado", "motivo_rechazo", ...autoria]),
  marcas_asistencia: proyeccion("marca_asistencia", [...sesion, "catequizando_id", "codigo_leido", "valor", "tipo_registro", "lista_id", "registrado_por", "hora_dispositivo", "desfase_reloj_ms", "recibido_en", "estado", "motivo_rechazo", ...autoria]),
  correcciones_asistencia: proyeccion("correccion_asistencia", [...sesion, "catequizando_id", "valor_anterior", "valor_nuevo", "motivo", "corregido_por", "hora_dispositivo", "desfase_reloj_ms", "recibido_en", "estado", "motivo_rechazo", ...autoria]),
  asistencias: proyeccion("asistencia", [...sesion, "catequizando_id", "valor", "tipo_registro", "hora_primer_registro", "recibido_primer_registro", "corregida", "conflicto"]),
  avisos_grupo: proyeccion("aviso_grupo", ["id", "grupo_id", "texto", "publicado_en"], { autor_visible: { entidad: "cuenta", campo: "identidad_operativa" } }),
  ciclos: proyeccion("ciclo", ["id", "nombre", "estado"], { fecha_inicio: { entidad: "ciclo", campo: "inicio" }, fecha_fin: { entidad: "ciclo", campo: "fin" } }),
  actividades_obligatorias: proyeccion("actividad_obligatoria", ["id", "ciclo_id", "nombre", "tipo", "fecha", "estado", "creado_por", ...autoria]),
});
export function validarProyeccionLocal(coleccion: string, campos: readonly string[]): void {
  if (!Object.hasOwn(PROYECCIONES_LOCALES, coleccion)) throw new Error(`coleccion_local_no_permitida:${coleccion}`);
  const fuentes = PROYECCIONES_LOCALES[coleccion]!;
  for (const campo of campos) {
    if (!Object.hasOwn(fuentes, campo)) throw new Error(`campo_local_no_permitido:${coleccion}.${campo}`);
    const fuente = fuentes[campo]!;
    if (esCampoRestringido(fuente.entidad, fuente.campo) || camposSinCatalogar([fuente]).length) throw new Error(`campo_local_restringido:${coleccion}.${campo}`);
  }
}
