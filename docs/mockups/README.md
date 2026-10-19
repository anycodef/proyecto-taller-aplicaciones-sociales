# Mockups de SIGECAT

Referencia **visual** de las pantallas. No es fuente de verdad funcional.

## Reglas de uso

1. Si un mockup contradice una spec, **manda la spec** (`specs/NNN-*/spec.md`). Si ves la contradicción, repórtala; no la resuelvas por tu cuenta.
2. Los textos entre corchetes (`[seudónimo]`, `[catequista]`, `N años`, `versión N`) son marcadores: se reemplazan con datos reales.
3. Los nombres de niños, grupos y apoderados son datos de ejemplo. No son reglas de negocio.
4. Reutiliza `src/components/ui` y `src/tema`; no copies colores ni medidas desde la imagen.
5. Una tarea puede cubrir varias páginas. Abre todas las que se indican.

Archivos: `SIGECAT_mockups.pdf` (original) y `p-01.png` … `p-43.png` (una por página, mismo orden).

## Spec 001 — Acceso y roles

| Página | Pantalla | Tarea | Ruta prevista |
| --- | --- | --- | --- |
| p-01 | Portada: "Abre tu enlace personal" + "Pegar enlace" | T001-81 | `src/app/index.tsx` |
| p-02 | "Verificando tu enlace…" (reintentar, aviso de primera vez con internet) | T001-82 | `src/app/acceso/equipo.tsx` |
| p-03 | "Crea tu PIN" (4 a 6 dígitos, teclado numérico) | T001-83 | `src/app/acceso/fijar-pin.tsx`, `src/components/seguridad/teclado-pin.tsx` |
| p-04 | "Ingresa tu PIN" + "Sin conexión · te quedan N días" | T001-84 | `src/app/acceso/desbloquear.tsx` |
| p-05 | "Conéctate para seguir registrando" (más de 14 días; modo consulta) | T001-84 (estado `requiere-conexion`) | `src/app/acceso/desbloquear.tsx` |
| p-06 | "Este celular quedó bloqueado" (5 fallos) | T001-84 | `src/app/acceso/desbloquear.tsx` |
| p-07 | "No pudimos abrir tu acceso" (enlace inválido, registros no enviados) | T001-86 | `src/app/acceso/sin-acceso.tsx` |
| p-13 | Consentimiento informado (componente compartido con 002) | T001-101 | componente de consentimiento presencial |

## Spec 002 — Perfil e inscripción

| Página | Pantalla | Tarea | Notas |
| --- | --- | --- | --- |
| p-08 | Lista de catequizandos (búsqueda, Mis grupos / Todos, "Disponible sin conexión") | T002-51 | Sobre la nómina local |
| p-09 | Perfil en línea | T002-52 | Documentos, Condiciones y Editar datos llegan en fases 2 y 3 (T002-80, 82, 86, 98) |
| p-10 | Perfil sin conexión | T002-52, T002-45 | Secciones restringidas muestran "Con conexión" |
| p-11 | Inscribir, paso 1 (datos del niño, aviso de edad fuera de 8 a 13) | T002-46 | |
| p-12 | Inscribir, paso 2 (apoderado nuevo o existente) | T002-47 | |
| p-13 | Inscribir, paso 3 (consentimiento) | T002-48 | Usa el componente de T001-101 |
| p-14 | Inscribir, paso 4 (grupo sugerido) | T002-49 | Conteos por condición: T002-99 |
| p-15 | "Este niño podría estar ya registrado" | T002-49 | Respuesta 409, sin mostrar datos |
| p-16 | "Inscribir requiere conexión" | T002-45, T002-50 | |
| p-17 | Lista de grupos de coordinación | T002-53 | |
| p-18 | Carné con QR | T002-55, T002-56 | |
| p-19 | Condiciones a considerar | T002-98 | Fase 3. Nunca se guarda en local |

## Spec 003 — Asistencia dominical

| Página | Pantalla | Tarea | Ruta prevista |
| --- | --- | --- | --- |
| p-20 | Escáner de misa | T003-79 | `src/app/asistencia/escanear.tsx` |
| p-21 | Menú inferior (hoja de opciones) | T003-77 | `src/app/asistencia/index.tsx` |
| p-22 a p-25 | Resultados: registrado con nombre, registrado, ya estaba registrado, carné no válido | T003-78, T003-80 | componente `confirmacion-escaneo` |
| p-26 | Registro manual | T003-81 | `src/app/asistencia/manual.tsx` |
| p-27 | Lista de catequesis (presentes por defecto) | T003-82 | `src/app/asistencia/lista/[grupoId].tsx` |
| p-28 | "Lista confirmada" | T003-83 | |
| p-29, p-30 | Selector de grupo y lista de un grupo ajeno (aviso amarillo) | T003-77, T003-82 | |
| p-31 | "Por enviar" | T003-84 | `src/app/asistencia/pendientes.tsx` |
| p-32 | Corregir asistencia (motivo obligatorio) | T003-85 | `src/app/asistencia/correccion/[sesionId]/[catequizandoId].tsx` |
| p-33 | Domingos del ciclo | T003-86 | `src/app/coordinacion/sesiones.tsx` |
| p-34 | Avisos de asistencia | T003-87 | `src/app/coordinacion/avisos-asistencia.tsx` |
| p-35 | Reporte de misa del domingo | T003-88 | `src/app/reportes/misa/[fecha].tsx` |
| p-36 | Asistencia del hijo (familia, solo lectura, HU-306) | Ver plan 003 | Lectura en línea |
| p-37 | "Hoy no hay misa ni catequesis" | T003-77 | Estado sin sesión en curso |

## Fuera de alcance actual (spec 004, justificaciones)

p-38 a p-43: inicio de familia, justificar, avisar evento escolar, reduciendo foto, "No se envió", "Recibimos tu justificación". No implementar hasta que exista el spec 004 con sus tareas.
