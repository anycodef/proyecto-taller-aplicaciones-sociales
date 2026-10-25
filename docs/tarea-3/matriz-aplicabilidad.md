# Matriz de aplicabilidad de GraphQL y gRPC (T009-12)

Alcance: funcionalidades reales de SIGECAT tomadas de `specs/001`–`specs/008`.
Cada fila cita sus RF, los requerimientos de origen R1–R27 y, cuando decide,
un principio de `docs/constitution.md`. Los contratos de la demo están
congelados en `tarea3/contratos/`.

## Leyenda

- **Protocolo recomendado**: `REST actual` es el HTTP/JSON que ya usa SIGECAT
  (incluido WatermelonDB); `GraphQL`, `gRPC` o `ninguno` son las alternativas
  evaluadas.
- **¿GraphQL? / ¿gRPC?**: `Sí` = aporta y es viable en ese contexto; `No` = no
  aporta, duplica riesgo o no es viable; `Parcial` = solo en la demo o en un
  servicio interno, nunca en la app móvil ni en Azure Functions.
- Una fila puede recomendar REST actual y aun así aceptar gRPC **dentro de la
  demo** como ejercicio servicio a servicio; eso se indica como `Parcial`.

## Matriz

| Id | Funcionalidad | Tipo | Protocolo recomendado | ¿GraphQL? | ¿gRPC? | Justificación atada a R1–R27 y a la constitución |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | Ficha consolidada del catequizando | Consulta | GraphQL | Sí | No | El panel de coordinación pide campos distintos según el rol y evita descargar bloques que no usa (R1, R3, R15, R20, R27). La app ya tiene el perfil operativo en WatermelonDB (R19) y no debe pedirlo por GraphQL. El acceso por rol se impone en el servidor (R26, Const. 7). |
| F-02 | Inscripción, correcciones y estados documentales | Actualización | REST actual | No | No | Es una escritura administrativa **solo online**, atómica y con consentimiento; GraphQL no aporta atomicidad y gRPC no corre en React Native/Expo (R1, R2, R3, R21, R26; Const. 5 y 7). El flujo ya tiene DTO estrictos y OpenAPI. |
| F-03 | Lista de asistencia a catequesis del domingo | Actualización | REST actual | No | Parcial | La escritura nace offline y se sincroniza por pull/push de WatermelonDB (R4, R6, R19, R20, R22, R27; Const. 5; ADR 015). gRPC solo se usa en la demo como lote servicio a servicio (RF-903), jamás como transporte del celular. |
| F-04 | Escaneo de carné QR en misa y registro manual | Actualización | REST actual | No | Parcial | Exige confirmación local en menos de un segundo y funcionar sin señal (R4, R5, R6, R18, R19, R20, R27; Const. 5). El QR se valida al sincronizar; un RPC remoto no puede sustituir la cola local. gRPC solo aparece en el lote de demostración. |
| F-05 | Observación en vivo de la asistencia de un grupo | Consulta en streaming | gRPC | No | Sí | Es un flujo de eventos para coordinación con conexión y picos dominicales (R5, R15, R22); el server streaming de RF-903 evita sondeo. GraphQL subscriptions añadiría WebSocket y otra superficie de autenticación. **Límite honesto:** Azure Functions no ejecuta gRPC nativo; esto vive en la demo local o en un futuro contenedor interno. |
| F-06 | Justificación de ausencia con foto | Actualización | REST actual | No | No | La evidencia viaja a Blob y se consulta con URL firmada; el enlace familiar no instala nada (R7, R8, R9, R20, R26; Const. 5 y 7). La carga de archivos en GraphQL no es estándar y gRPC obligaría a un cliente binario en el navegador. |
| F-07 | Bandeja de revisión de justificaciones | Consulta | GraphQL | Sí | No | La coordinación filtra por grupo, estado y fecha y solo necesita algunos campos; la evidencia se resuelve aparte con URL firmada (R7, R8, R15, R20, R26). Reduce datos y digitación sin exponer la foto en la respuesta. |
| F-08 | Aprobar o rechazar una justificación | Actualización | REST actual | No | No | Es una decisión auditada, solo de coordinación o delegado y online (R7, R8, R26; Const. 5 y 7). GraphQL podría exponer la mutación, pero no mejora la transacción ni la traza; gRPC no es alcanzable desde el enlace web. |
| F-09 | Evaluación de oraciones para todo un grupo | Actualización | REST actual | No | Parcial | Se evalúa con un toque por niño y sin señal (R10, R19, R27; Const. 5). La lista completa ya viaja por el lote de sincronización; gRPC solo tiene sentido como lote interno de la demo. |
| F-10 | Avance formativo y oraciones pendientes | Consulta | GraphQL | Sí | No | El perfil y el panel piden solo las dimensiones visibles para cada rol (R10, R11, R15, R20, R27; Const. 7). El resumen offline se lee de WatermelonDB, no de un servidor GraphQL. |
| F-11 | Actividades obligatorias y su cumplimiento | Actualización | REST actual | No | No | La asistencia se reutiliza de la lista dominical y se registra offline (R12, R19; Const. 5). No hay consulta compleja que justifique un nuevo borde. |
| F-12 | Tablero de riesgo de deserción | Consulta | GraphQL | Sí | No | Coordinación y catequistas piden el mismo riesgo con distinto detalle; GraphQL selecciona campos y pagina (R14, R15, R20, R27; Const. 7). El contrato gRPC no tiene una consulta de riesgo por grupo: solo recalcula uno. |
| F-13 | Recalcular el riesgo de un catequizando | Actualización interna | gRPC | No | Sí | Es una llamada servicio a servicio, tipada y de alto volumen potencial; la regla pura vive en `compartido/riesgo.ts` y se persiste una vez (RF-908, R14, R22). La mutación GraphQL solo delega en gRPC (RF-904), no duplica la regla. |
| F-14 | Tablero de aptitud sacramental | Consulta | GraphQL | Sí | No | Coordinación y supervisión leen tres dimensiones con campos distintos y solo lectura (R13, R15, R20, R26). Evita enviar el expediente completo a quien solo necesita el resumen. |
| F-15 | Decisión final de aptitud | Actualización | REST actual | No | No | Es de baja frecuencia, solo coordinación o delegado y con motivo obligatorio (R13, R26; Const. 5 y 7). Un protocolo nuevo no mejora la transacción ni la inmutabilidad de la decisión. |
| F-16 | Historial de ciclos e indicadores | Consulta | GraphQL | Sí | No | Supervisión y coordinación piden agregados por ciclo y campos opcionales (R17, R15, R20, R23). La paginación y el límite de profundidad evitan reportes costosos (RNF-903). |
| F-17 | Búsqueda de constancia sacramental | Consulta | REST actual | No | No | Es una búsqueda exacta por nombre y fecha de nacimiento, restringida y auditada (R17, R26). Un campo de consulta abierto en GraphQL ampliaría la superficie de fuga sin aportar al caso de uso. |
| F-18 | Enlaces de familia, enlaces del equipo y delegaciones | Actualización | REST actual | No | No | Emitir y revocar credenciales es una operación sensible, solo online y auditada (R16, R21, R26; Const. 7). GraphQL/gRPC no aportan y aumentarían los canales que hay que proteger. |
| F-19 | Auditoría de acceso a datos restringidos | Consulta restringida | REST actual | No | No | Debe ser append-only y con permisos explícitos; se exporta, no se navega libremente (R25, R26). Un esquema GraphQL introspectable facilitaría el descubrimiento de datos que la auditoría debe celar. |
| F-20 | Sincronización offline pull/push de WatermelonDB | Consulta y actualización por lote | REST actual | No | No | El protocolo nativo es parte del motor local y está congelado por el ADR 015 (R19, R20, R22; Const. 5). Reemplazarlo por GraphQL o gRPC obligaría a reescribir la app y a renunciar a la operación sin señal. |
| F-21 | Retención y anonimización al cerrar ciclo | Proceso por lote | ninguno | No | No | Lo ejecuta un temporizador del backend, sin interfaz ni cliente (R17, R23, R26). Exponerlo como API sería un riesgo innecesario. |
| F-22 | Reporte de misa para supervisión | Consulta | GraphQL | Sí | No | La supervisión necesita presentes, hora, registrador y tipo de registro, con solo lectura (R5, R15, R20, R27; Const. 7). GraphQL permite pedir exactamente esas columnas. |

## Cobertura de R1–R27

| Requerimiento | Filas que lo cubren |
| --- | --- |
| R1 Perfil único | F-01, F-02 |
| R2 Datos y documentos | F-02 |
| R3 Salud, neurodivergencia y grupos | F-01, F-02 |
| R4 Misa y catequesis | F-03, F-04 |
| R5 Misa verificable | F-04, F-05, F-22 |
| R6 Más rápido que el papel | F-03, F-04 |
| R7 Fuera del WhatsApp | F-06, F-07, F-08 |
| R8 Evidencia en el perfil | F-06, F-07, F-08 |
| R9 Mecanismo sencillo | F-06 |
| R10 Oraciones | F-09, F-10 |
| R11 Doctrina | F-10 |
| R12 Actividades obligatorias | F-11 |
| R13 Aptitud sacramental | F-14, F-15 |
| R14 Riesgo de deserción | F-12, F-13 |
| R15 Consulta descentralizada | F-01, F-05, F-07, F-10, F-12, F-14, F-16, F-22 |
| R16 Continuidad sin coordinación | F-18 |
| R17 Historial institucional | F-16, F-17, F-21 |
| R18 Mobile-first | F-04 |
| R19 Offline-first | F-03, F-04, F-09, F-11, F-20 |
| R20 Consumo mínimo de datos | F-01, F-03, F-04, F-06, F-07, F-10, F-12, F-14, F-16, F-22 |
| R21 Usuarios autenticados | F-02, F-18 |
| R22 Picos dominicales | F-03, F-04, F-05, F-13 |
| R23 Costo cero | F-16, F-21 |
| R24 Administración mínima | F-21 |
| R25 Anonimizar catequistas menores | F-05, F-19 |
| R26 Protección de datos de menores | F-01, F-02, F-06, F-07, F-08, F-14, F-15, F-17, F-18, F-19, F-21 |
| R27 Minimizar digitación | F-01, F-03, F-04, F-09, F-10, F-12, F-22 |

## Verificación de honestidad

- No se propone GraphQL ni gRPC para el transporte de sincronización de la app:
  no hay ganancia y sí pérdida de offline y de compatibilidad (Const. 5; ADR 015).
- No se propone gRPC en el borde móvil ni en Azure Functions: no es viable sin
  cambiar la infraestructura aprobada (Const. 1; ADR 014).
- No se propone GraphQL para archivos, credenciales, auditoría ni retención:
  añade superficie sin resolver el problema real (R8, R21, R26; Const. 7).
- Donde la demo usa gRPC (lotes y streaming), la matriz lo marca `Parcial` y no
  lo presenta como arquitectura de producción.
