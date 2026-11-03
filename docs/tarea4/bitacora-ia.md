# Bitácora de uso de IA generativa — SIGECAT

**Tarea 4, punto 1 · Fecha de elaboración: 1 de noviembre de 2026.**

Esta bitácora reúne **14 usos distintos** de IA generativa registrados en
`docs/agent-trace/`: dos intervenciones en el backend, once tareas del cliente y
un análisis de protocolos. Supera los 10 usos del enunciado y el objetivo de 12
usos de esta entrega. Cada entrada identifica la tarea, herramienta y modelo,
el prompt resumido, el resultado y cómo se verificó.

## Criterio de elaboración y límites de evidencia

- **Fuente:** trazas versionadas disponibles en `origin/main`, commit
  `654dfea`, base de la rama `tarea4/ia-arquitectura`. Se conservan las fechas,
  herramientas y nombres de modelo tal como aparecen en los JSON.
- **Prompt resumido:** cuando existe `solicitud`, se sintetiza y se contextualiza
  con `criterio`. Cuando falta, se marca **reconstruido** desde el alcance,
  autorización, tareas y cambios; no es una transcripción del prompt original.
- **Resultado:** “Aceptado” significa aceptación técnica inferida de un resultado
  implementado y con comprobaciones registradas; no aprobación humana explícita.
  “Modificado” indica correcciones o ajustes documentados. Las trazas no contienen
  un campo uniforme de aceptación; no se inventan usos descartados para completar
  las categorías del enunciado.
- **Verificación histórica:** se resume lo informado por cada traza, sin afirmar
  que esos comandos se hayan reejecutado para cada uso durante esta elaboración.
  Los conteos acumulados o por lote no se suman entre sí. Una simulación no acredita
  funcionamiento en un celular físico, despliegue Azure ni prueba de carga.
- **Modelos:** sus identificadores son datos declarados por las trazas; no se
  verificó su identidad mediante registros del proveedor.
- **Comprobaciones actuales:** se registran por separado en
  [la traza de esta elaboración](../agent-trace/tarea4-bitacora-ia.json).
  La [spec 010](../../specs/010-bitacora-ia/spec.md) limita la entrega al punto 1.

## Registro de usos

### Uso 01 — Seguridad, roles y protección de datos

- **Tarea:** T001-29 a T001-143 (selección registrada en la traza).
- **Fecha:** 2026-10-11.
- **Herramienta:** OpenCode.
- **Modelo:** `openai/gpt-6.1-sol`.
- **Prompt reconstruido:** Implementar el backend de acceso, roles, credenciales, consentimiento y retención conforme a la spec 001.
- **Resultado:** Modificado. La traza registra una corrección de privilegios: sigecat_api heredaba acceso a identidad_real; se añadió la migración 0108 sin editar migraciones previas. No acredita cierre de todas las tareas.
- **Verificación histórica:** RF-105 detectó el defecto. La traza informa pruebas de roles reales, 7 tests unitarios y 4 de integración del catálogo, además de typecheck y lint de esa revisión. Los resultados anteriores se conservan expresamente como históricos; despliegue y campo pendientes.
- **Fuente:** [backend-001.json](../agent-trace/backend-001.json).

### Uso 02 — Asistencia y sincronización

- **Tarea:** T003-12 a T003-115 (selección registrada en la traza).
- **Fecha:** 2026-10-11.
- **Herramienta:** OpenCode.
- **Modelo:** `openai/gpt-6.1-sol`.
- **Prompt reconstruido:** Implementar el backend completo de asistencia y sincronización de la spec 003, respetando las rutas asignadas y corrigiendo el estado calculado antes de la migración 0310.
- **Resultado:** Modificado. Se corrigió el rechazo indebido de correcciones sobre ausencia calculada y sin_registro; se añadió la migración 0310 y regresiones. La traza mantiene tareasMarcadasCompletas=false.
- **Verificación histórica:** La traza informa 45/45 tests propios de asistencia y una ejecución integral histórica de 178/178 tests API y 1/1 cliente. Incluye PostgreSQL, concurrencia y correcciones sin marcas. Typecheck y lint pasaron en esa ejecución. El script k6 no se ejecutó.
- **Fuente:** [backend-003.json](../agent-trace/backend-003.json).

### Uso 03 — Configurar almacenamiento seguro y criptografía

- **Tarea:** T001-74.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir literalmente el Hecho cuando; para T001-74, instalar y configurar el almacenamiento seguro y la criptografía.
- **Resultado:** Aceptado. Se incorporaron expo-secure-store y expo-crypto y la configuración del plugin. La aceptación técnica se infiere de los cambios y resultados registrados.
- **Verificación histórica:** npx expo config --type public mostró el plugin y android.package; npm run test:app registró 3 tests aprobados, typecheck de raíz/API y lint sin advertencias. Evidencia de configuración, sin prueba física.
- **Fuente:** [cliente-t001-74.json](../agent-trace/cliente-t001-74.json).

### Uso 04 — Implementar el almacén seguro del celular

- **Tarea:** T001-75.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir el Hecho cuando; para T001-75, guardar dispositivo, cuentas y sesión mínima.
- **Resultado:** Aceptado. Se implementó el almacén seguro con dependencias inyectables, sin nombres en la sesión y con límite de 2048 bytes. La aceptación técnica se infiere de la traza.
- **Verificación histórica:** Con SecureStore simulado se comprobó RF-111: identificador reutilizable; RF-112: sesión sin nombres y menor de 2 KB; RNF-102: cuentas registradas. El acumulado era 6 tests cliente; typecheck y lint pasaron. Sin dispositivo real.
- **Fuente:** [cliente-t001-75.json](../agent-trace/cliente-t001-75.json).

### Uso 05 — Cliente HTTP con renovación automática

- **Tarea:** T001-76.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir el Hecho cuando; para T001-76, inyectar credenciales y gestionar 401, renovación y credencial terminada.
- **Resultado:** Aceptado. Se implementaron JWT, cabecera APIM, una renovación y navegación inyectada. La aceptación técnica se infiere de los cambios registrados.
- **Verificación histórica:** Con fetch falso: RF-101 cubrió renovación única y credencial_terminada; RNF-103 rechazó HTTP fuera de desarrollo. La traza informa 9 tests cliente acumulados, typecheck y lint aprobados; no una prueba contra despliegue real.
- **Fuente:** [cliente-t001-76.json](../agent-trace/cliente-t001-76.json).

### Uso 06 — Activación y PIN local

- **Tarea:** T001-77.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir el Hecho cuando; para T001-77, activar el enlace y guardar la credencial solo después de fijar el PIN.
- **Resultado:** Aceptado. Se mantuvo la activación pendiente en memoria y se almacenó la credencial después del PIN. La aceptación técnica se infiere de la traza.
- **Verificación histórica:** RF-111 comprobó que la credencial se guarda tras fijar el PIN y que ninguna petición incluye PIN, sal o hash. Cliente falso; 11 tests cliente acumulados, typecheck y lint aprobados. Sin servidor real.
- **Fuente:** [cliente-t001-77.json](../agent-trace/cliente-t001-77.json).

### Uso 07 — Desbloqueo y bloqueo por intentos fallidos

- **Tarea:** T001-78.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir el Hecho cuando; para T001-78, bloquear al quinto fallo y permitir desbloqueo sin conexión dentro del plazo.
- **Resultado:** Aceptado. Se borraron token, sal y verificador al quinto fallo y se implementó el aviso al servidor sin deshacer el bloqueo si falla. La aceptación técnica se infiere de la traza.
- **Verificación histórica:** Con cliente y reloj falsos: RF-111 verificó los cinco fallos y el aviso; RF-112, el desbloqueo antes de 14 días. El acumulado era 14 tests cliente y pasaron typecheck y lint.
- **Fuente:** [cliente-t001-78.json](../agent-trace/cliente-t001-78.json).

### Uso 08 — Proveedor del contexto de sesión

- **Tarea:** T001-79.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir el Hecho cuando; para T001-79, exponer tipo, estado, contexto y roles efectivos de la sesión.
- **Resultado:** Aceptado. Se implementó el proveedor con carga inyectada y roles calculados por el dominio. La aceptación técnica se infiere de los cambios registrados.
- **Verificación histórica:** El test RNTL RF-102 comprobó los roles efectivos expuestos. La traza informa 15 tests cliente acumulados, typecheck de raíz/API y lint sin advertencias. La carga inyectada permite probar sin SecureStore.
- **Fuente:** [cliente-t001-79.json](../agent-trace/cliente-t001-79.json).

### Uso 09 — Protección de rutas por sesión

- **Tarea:** T001-80.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Empezar las tareas del Orden 1 y cumplir el Hecho cuando; para T001-80, proteger rutas de equipo y familia y conservar sus URL.
- **Resultado:** Aceptado. Se registraron grupos de rutas con Stack.Protected y guard. La aceptación técnica se infiere de la implementación y sus pruebas, con la limitación descrita.
- **Verificación histórica:** RF-102 comprobó las rutas registradas sin sesión y con sesión familiar mediante expo-router/testing-library: 17 tests cliente acumulados, typecheck y lint aprobados. La navegación directa protegida fallaba en el entorno de pruebas; se verificaron rutas registradas, no navegación física.
- **Fuente:** [cliente-t001-80.json](../agent-trace/cliente-t001-80.json).

### Uso 10 — Pantalla inicial con entrada por enlace

- **Tarea:** T001-81.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Continuar el frontend usando docs/mockups como referencia visual; adaptar el inicio para abrir o pegar el enlace personal.
- **Resultado:** Aceptado. Se creó el inicio por enlace, token temporal en memoria y redirección por rol. La aceptación técnica se infiere de la traza.
- **Verificación histórica:** RF-101 verificó la invitación a abrir el enlace sin sesión. La traza informa 28 tests cliente tras el lote de pantallas, typecheck, lint y npx expo export --platform web con 12 rutas. El conteo de 28 pertenece al lote, no solo a esta tarea.
- **Fuente:** [cliente-t001-81.json](../agent-trace/cliente-t001-81.json).

### Uso 11 — Pantalla de activación del equipo

- **Tarea:** T001-82.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Continuar el frontend usando docs/mockups como referencia visual; activar el enlace del equipo y pasar a fijar el PIN.
- **Resultado:** Aceptado. Se implementaron lectura del enlace, activación, reintento e indicación de conexión necesaria. La aceptación técnica se infiere de la traza.
- **Verificación histórica:** El test RNTL RF-111 simuló useURL, comprobó activarEquipo con el token y la navegación a fijar-pin. Aprobado dentro del lote de 28 tests cliente; typecheck y lint pasaron. No verificado en dispositivo real.
- **Fuente:** [cliente-t001-82.json](../agent-trace/cliente-t001-82.json).

### Uso 12 — Teclado y confirmación de PIN

- **Tarea:** T001-83.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Continuar el frontend usando docs/mockups como referencia visual; crear el teclado y pedir el PIN dos veces, con validación del dominio.
- **Resultado:** Modificado. Se adaptó el mockup: se muestran siempre seis espacios porque el plan no incluye persistir la longitud del PIN. El componente reutiliza el tema y se añadió a la galería.
- **Verificación histórica:** Dos tests RNTL RF-111 verificaron rechazo de longitudes de 3 o 7 dígitos y confirmación del PIN; aprobados dentro del lote de 28 tests cliente. Typecheck y lint pasaron. La traza documenta la desviación visual.
- **Fuente:** [cliente-t001-83.json](../agent-trace/cliente-t001-83.json).

### Uso 13 — Pantalla de desbloqueo y modo consulta

- **Tarea:** T001-84.
- **Fecha:** 2026-10-19.
- **Herramienta:** OpenCode.
- **Modelo:** `minimax-m3.1-flash-free`.
- **Prompt resumido:** Continuar el frontend usando docs/mockups como referencia visual; mostrar días sin conexión, modo consulta y bloqueo al quinto fallo.
- **Resultado:** Modificado. Se usó el texto de la tarea y se omitió el seudónimo porque el plan no lo guarda en el celular. La detección de red quedó pendiente de la spec 003.
- **Verificación histórica:** Cuatro tests RNTL verificaron RF-112 (días restantes y prohibición de registros en requiere-conexion) y RF-111 (nuevo enlace tras cinco fallos), dentro del lote de 28 tests cliente. Typecheck y lint pasaron; la detección de red no queda acreditada.
- **Fuente:** [cliente-t001-84.json](../agent-trace/cliente-t001-84.json).

## Revisión de la entrega

La selección cubre configuración, programación, seguridad, pruebas, interfaz y
análisis de arquitectura. Los usos modificados muestran correcciones concretas:
privilegios indebidos, correcciones de asistencia sin marcas, adecuación del PIN
al plan y límites de una medición de contratos. Los pendientes permanecen visibles
para evitar presentar una propuesta de IA como una funcionalidad ya validada.

La comprobación documental se reproduce desde la raíz del repositorio con:

```bash
node --test docs/tarea4/pruebas/bitacora-ia.test.mjs
```

Esta prueba comprueba los campos, la trazabilidad y los límites declarados;
no certifica por sí sola el comportamiento histórico de la aplicación.
