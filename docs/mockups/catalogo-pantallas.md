# Catálogo de pantallas

Tabla maestra de las pantallas de SIGECAT. La imagen de cada pantalla está en
`app/` o `web/` con su ID en minúsculas (`APP-38` → `app/app-38.png`).

## Cómo leerlo

- **APP**: app del equipo (Expo nativo, offline primero). **WEB**: Expo web para
  la familia y la supervisión (siempre en línea). Una pantalla WEB es un solo
  componente fluido: no hay una versión móvil y otra de escritorio. WEB-15 y
  WEB-16 (supervisión) usan el ancho completo del monitor con una tabla; el
  resto, una columna que se centra en pantallas grandes.
- **Antes**: número `p-NN` del PDF original (`legacy/`). Sirve para entender
  tareas y commits anteriores.
- **Cambio**: `=` igual que antes · `mod` modificada · `nueva` no existía.
- **Imagen**: la tabla indica el archivo real de cada pantalla. En el tramo
  APP-20 a APP-37 los archivos van un número por encima del identificador
  (APP-20 → `app/app-21.png`), porque en ese tramo se insertó una pantalla
  nueva. Cada fila dice el suyo.
- Si una tarea de `tasks.md` indica otra ruta, manda la tarea.
- Si el mockup contradice la spec, manda la spec. Repórtalo.
- Abre solo las imágenes que cita la tarea, no todo el catálogo.

## Spec 001 — Acceso y roles

| ID | Pantalla | Antes | Cambio | Ruta / nota |
| --- | --- | --- | --- | --- |
| APP-01 | Inicio sin sesión | p-01 | = | `src/app/index.tsx` |
| APP-02 | Activando el enlace | p-02 | = | `acceso/equipo.tsx` |
| APP-03 | Crear PIN | p-03 | = | `acceso/fijar-pin.tsx` |
| APP-04 | Desbloquear con PIN | p-04 | = | `acceso/desbloquear.tsx` |
| APP-05 | Más de 14 días sin conexión | p-05 | = | estado de `desbloquear.tsx` |
| APP-06 | Bloqueado por 5 fallos | p-06 | = | estado de `desbloquear.tsx` |
| APP-07 | Acceso denegado | p-07 | = | `acceso/sin-acceso.tsx` |
| WEB-01 | Inicio sin enlace | p-01 | mod | Sin "Pegar enlace" · `index.tsx` |
| WEB-02 | Abriendo tu enlace | p-02 | mod | Sin aviso de primera vez · `acceso/equipo.tsx` |
| WEB-03 | No pudimos abrir tu acceso | p-07 | mod | Sin aviso de registros no enviados · `acceso/sin-acceso.tsx` |
| WEB-12 | Consentimiento informado | — | nueva | `(familia)/consentimiento` · se llega desde WEB-04 |
| WEB-13 | Retirar consentimiento | — | nueva | Desde WEB-12 |
| WEB-14 | Consentimiento retirado | — | nueva | Tras confirmar WEB-13 |

### Spec 001 sin mockup

Estas pantallas tienen contrato de datos y tareas cerradas, pero no tienen
imagen de referencia. Se registran aqui para que el catalogo siga siendo la
tabla maestra. La imagen se dibujara cuando la coordinacion pida revisarlas.

| ID | Pantalla | Antes | Cambio | Ruta / nota |
| --- | --- | --- | --- | --- |
| APP-82 | Lista de cuentas | — | nueva | `(equipo)/cuentas/index.tsx` |
| APP-83 | Alta de cuenta | — | nueva | `(equipo)/cuentas/nueva.tsx` |
| APP-84 | Ficha de cuenta y enlace | — | nueva | `(equipo)/cuentas/[id].tsx` |
| APP-85 | Delegaciones | — | nueva | `(equipo)/delegaciones/index.tsx` |
| APP-86 | Nueva delegacion | — | nueva | `(equipo)/delegaciones/nueva.tsx` |
| APP-87 | Auditoria | — | nueva | `(equipo)/auditoria.tsx` |
| APP-88 | Avisos del sistema | — | nueva | `(equipo)/avisos-sistema.tsx` |

### Utilidades de desarrollo

`/navegacion` (`src/app/navegacion.tsx`) no es una pantalla del producto: es el
indice de pantallas para revisarlas en el navegador. Vive fuera del catalogo a
proposito, pero se anota aqui para que no se confunda con una pantalla nueva.

## Spec 002 — Perfil e inscripción

| ID | Pantalla | Antes | Cambio | Nota |
| --- | --- | --- | --- | --- |
| APP-08 | Lista de catequizandos | p-08 | = | `catequizandos/index.tsx` |
| APP-08b | Catequizandos, modo selección | — | nueva | Misma lista; la usan APP-42 y APP-61 |
| APP-09 | Perfil (con conexión) | p-09 | mod | Filas Aptitud y Riesgo, y resumen tocable: **pendiente de spec** (dependen de 006 y 007) · `catequizandos/[id]/index.tsx` |
| APP-10 | Perfil (sin conexión) | p-10 | mod | Igual; filas Aptitud y Riesgo: **pendiente de spec** (dependen de 006 y 007) · `catequizandos/[id]/index.tsx` |
| APP-11 a APP-19 | Inscripción, duplicado, sin conexión, grupos, carné, condiciones | p-11 a p-19 | = | Mismo orden |

## Spec 003 — Asistencia

| ID | Pantalla | Antes | Cambio | Nota |
| --- | --- | --- | --- | --- |
| APP-20 | Misa en curso (escáner) | p-20 | = | `app/app-21.png` · `asistencia/escanear.tsx` (pendiente de aprobar `expo-camera`) |
| APP-21 | Menú | p-21 | mod (Oraciones y doctrina, Aptitud, Riesgo) | `app/app-22.png` · `(equipo)/asistencia/index.tsx` · estado con sesión en curso (sin sesión es APP-37) |
| APP-22 | Coordinación (hub) | — | nueva (acceso a 004 a 008) | `app/app-23.png` |
| APP-23 a APP-26 | Resultados de escaneo (4 estados) | p-22 a p-25 | = | `app/app-24.png` a `app/app-27.png` · `components/asistencia/confirmacion-escaneo.tsx` |
| APP-27 | Registro manual | p-26 | = | `app/app-28.png` · `(equipo)/asistencia/manual.tsx` |
| APP-28 | Lista de catequesis | p-27 | mod (chip de justificación) | `app/app-29.png` · `(equipo)/asistencia/lista/[grupoId].tsx` |
| APP-29 | Lista confirmada | p-28 | = | `app/app-30.png` |
| APP-30, APP-31 | Elegir grupo · Lista de otro grupo | p-29, p-30 | = | `app/app-31.png`, `app/app-32.png` |
| APP-32 | Por enviar | p-31 | = | `app/app-33.png` · `(equipo)/asistencia/pendientes.tsx` |
| APP-33 | Corregir asistencia | p-32 | mod (aviso de justificación) | `app/app-34.png` · `(equipo)/asistencia/correccion/[sesionId]/[catequizandoId].tsx` |
| APP-34, APP-35, APP-36 | Domingos del ciclo · Avisos · Reporte de misa | p-33 a p-35 | = | `app/app-35.png` a `app/app-37.png` |
| APP-37 | Inicio entre semana | p-37 | mod | `app/app-38.png` · estado de `(equipo)/asistencia/index.tsx` sin sesión en curso (no es APP-01, que es `src/app/index.tsx`) |
| WEB-10 | Asistencia de mi hijo (solo lectura) | p-36 | mod (estado y "Justificar") | `web/web-10.png` · `(familia)/familia/asistencia/[catequizandoId].tsx` (T003-111) |

## Spec 004 — Justificaciones

| ID | Pantalla | Antes | Nota |
| --- | --- | --- | --- |
| APP-38 | Bandeja de justificaciones | — | `coordinacion/justificaciones/index.tsx` |
| APP-39 | Detalle del lote | — | `…/[loteId].tsx` |
| APP-40 | Rechazar (hoja inferior) | — | Dentro de APP-39 |
| APP-41 | Visor de evidencia | — | Componente `visor-evidencia`; sin caché |
| APP-42 | Registrar en nombre de | — | `…/registrar.tsx`; usa APP-08b |
| APP-43 | Plazo de justificación | — | `…/plazo.tsx` |
| APP-44 | Justificaciones del niño | — | Desde APP-09 |
| WEB-04 | Inicio de familia | p-38 | mod: tarjetas Cómo va, Asistencia y Consentimiento | `(familia)/familia.tsx` |
| WEB-05 | Justificar ausencia | p-39 | `familia/justificar` |
| WEB-06 | Justificación anticipada | p-40 | `familia/anticipar` |
| WEB-07 | Enviando | p-41 | Estado de WEB-05 |
| WEB-08 | No se envió | p-42 | Estado de WEB-05; no deja cola |
| WEB-09 | Recibimos tu justificación | p-43 | `familia/enviada` |

## Spec 005 — Avance formativo

| ID | Pantalla | Nota |
| --- | --- | --- |
| APP-45 | Avance formativo del niño | Desde APP-09; botón a APP-58 |
| APP-46 | Elegir oración | Desde APP-21; reutiliza APP-30 para el grupo |
| APP-47 | Evaluar oración por lista | Un toque por niño |
| APP-48 | Evaluar doctrina por lista | Misma lógica que APP-47, otra escala |
| APP-49, APP-50 | Historial de una oración · Corregir evaluación | |
| APP-51, APP-52 | Catálogo de oraciones · de doctrina | Desde APP-22 |
| APP-53, APP-54, APP-55 | Actividades · Nueva · Detalle | Desde APP-22 |
| APP-56 | Oraciones pendientes del grupo | Advertencia obligatoria |
| WEB-11 | Cómo va mi hijo (familia) | Sin propuesta ni decisión |

## Spec 006 — Aptitud

| ID | Pantalla | Nota |
| --- | --- | --- |
| APP-57 | Tablero de aptitud | Sin conexión |
| APP-58 | Aptitud de un niño | |
| APP-59 | Decisión final | Hoja inferior; motivo obligatorio si difiere |
| APP-60 | Umbrales del ciclo | También guarda el N de posible abandono (spec 007) |
| APP-61 | Saldo desde papel | Una sola carga para aptitud y riesgo |
| APP-62 | Avisos de aptitud | |
| APP-63 | Cerrar decisiones y lista | Compartir con secretaría |
| WEB-15 | Supervisión: lista de aptos | Escritorio, solo lectura |

## Spec 007 — Riesgo de deserción

| ID | Pantalla | Nota |
| --- | --- | --- |
| APP-64 | Lista de riesgo | Calculada en servidor; el celular no recalcula |
| APP-65 | Riesgo de un niño | |
| APP-66 | Posible abandono | |
| APP-67 | Registrar contacto | Nota de 140 caracteres |
| APP-68 | Ficha de compromiso | Sin imagen |
| APP-69 | Confirmar retiro | Motivo y segunda confirmación |

## Spec 008 — Historial de ciclos

| ID | Pantalla | Nota |
| --- | --- | --- |
| APP-70 a APP-73 | Ciclos · Abrir · Indicadores · Cerrar | Solo con conexión; abrir y cerrar son de administración |
| APP-74 | Sacramentos recibidos | Funciona con el ciclo cerrado |
| APP-75, APP-76, APP-77 | Buscar constancia · Detalle · Corregir | |
| APP-78, APP-79 | Reinscribir: candidatos · Confirmar | |
| APP-80 | No hay un ciclo abierto | Estado global |
| WEB-16 | Supervisión: constancia | Escritorio, solo lectura |

## Pantallas implementadas sin mockup (no borrar)

Pantallas del spec 001 que no tienen imagen todavía. Se construyen según su tarea.
Cuentas (lista, alta, ficha), delegaciones (lista, nueva), auditoría, avisos del
sistema y compartir enlace. `navegacion.tsx` es una utilidad de desarrollo.