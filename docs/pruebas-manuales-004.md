# Pruebas manuales y criterios de finalización de la spec 004

Guía para cerrar T004-72 y T004-73 de `specs/004-justificaciones/tasks.md`. Los resultados se copian en la descripción del PR de `feat/004-justificaciones`. Las casillas `[ ]` se marcan solo con la prueba hecha: los tests automáticos no las sustituyen.

## Preparación

1. Levantar PostgreSQL y Azurite: `docker compose -f api/docker-compose.yml up -d`.
2. Levantar la API: `npm --prefix api start`. En Windows, `npm --prefix api run build` falla por las rutas `/C:/...` del alias `@/lib` en esbuild. Hay que compilar en Linux o en CI.
3. Generar un build de desarrollo Android: `npx expo run:android` (paquete `org.sigecat.app`).
4. Sembrar un ciclo abierto con un grupo y dos catequistas: uno del grupo y otro de un grupo distinto. Añadir también una cuenta de coordinación, un niño con ausencias recientes y un enlace de familia para su apoderado.

## T004-72 · No queda evidencia en el celular (RNF-403, RNF-404, RNF-405)

Usar un Android de gama baja con el build de desarrollo.

| # | Paso | Resultado esperado | Resultado |
| --- | --- | --- | --- |
| 1 | Abrir el enlace de familia y entrar en «Justificar». Elegir una foto y activar el modo avión. Pulsar «Enviar». | Aviso «Sin conexión. Las justificaciones necesitan señal y nada se guarda en este celular.» | [ ] |
| 2 | `adb shell run-as org.sigecat.app ls -R cache files` | Ninguna foto `.jpg` ni archivo de `ImageManipulator` o `ImagePicker` | [ ] |
| 3 | Con red, enviar la justificación. Repetir el comando del paso 2. | Tampoco queda ningún archivo | [ ] |
| 4 | Con la cuenta de coordinación sin red, abrir «Justificaciones» y el detalle de un lote. | La bandeja y el visor muestran el aviso de sin conexión | [ ] |
| 5 | Con red, abrir la evidencia. Copiar la URL de la imagen desde las herramientas de red. Pedirla con `curl -s -o /dev/null -w "%{http_code}" "<url>"` a los 6 minutos. | `403` | [ ] |

## T004-73 · Medición en campo (RNF-401, RF-401, RF-402, RF-410)

Participan 5 apoderados como mínimo, cada uno con su propio celular y sin la app instalada. Se les entrega el enlace por el canal habitual. El cronómetro arranca al abrir el enlace y se detiene al aparecer la pantalla «Justificación recibida».

| Apoderado | Modelo del celular | Tiempo (s) | ¿Menos de 60 s? | Observaciones |
| --- | --- | --- | --- | --- |
| 1 | | | [ ] | |
| 2 | | | [ ] | |
| 3 | | | [ ] | |
| 4 | | | [ ] | |
| 5 | | | [ ] | |

Después, entrar con el catequista de otro grupo y comprobar que no ve el estado ni la evidencia de esas justificaciones: [ ]

## Criterios de finalización de la spec

| Criterio | Respaldo automático | Verificación manual |
| --- | --- | --- |
| Un apoderado abre su enlace sin la app, ve la ausencia, adjunta foto y envía en menos de 1 minuto | `RF-401: devuelve las ausencias justificables de los hijos con niño, fecha y sesión`; e2e `RF-409: tras aprobar, la falta deja de contar` | T004-73 |
| Una evidencia para tres fechas crea tres justificaciones ligadas a sus fechas | `RF-403: un lote de tres fechas crea tres justificaciones con la misma evidencia`; `RF-403: una evidencia, tres justificaciones ligadas a sus fechas`; e2e | — |
| Aparece en el perfil y en la bandeja; solo la coordinación aprueba | `RF-410: el resumen del perfil de 002 solo trae el estado visible`; `RF-408: solo la coordinación o un delegado vigente puede revisar`; `RF-408: la bandeja lista las pendientes por lote` | — |
| Tras aprobarla, la falta deja de contar | e2e `RF-409: tras aprobar, la falta deja de contar`; `RF-409: con una aprobada de esa fecha faltasDelCiclo marca la falta como justificada` | — |
| Vencido el plazo, la ausencia deja de ofrecerse | e2e `RF-405: vencido el plazo, la ausencia deja de ofrecerse` | — |
| La registrada por la coordinación en nombre de un apoderado queda marcada | `RF-406: una registrada por la coordinación se etiqueta como tal`; `RF-406: registrada por la coordinación en nombre de, con quién y cuándo` | — |
| Un catequista del grupo ve el estado y uno de otro grupo no ve nada | `RF-410: un catequista de otro grupo recibe 403 al ver estado y evidencia`; `RF-410: el catequista recibe solo los estados de sus grupos` | T004-73 |
| Sin conexión el envío falla con aviso y la foto no queda guardada | `RNF-404: sin conexión avisa y borra los temporales sin escribir en almacenamiento`; `RNF-404: sin conexión muestra un aviso y no guarda nada` | T004-72, pasos 1 a 3 |

## Pendientes conocidos al cerrar la fase 7

- T004-62: falta el paso de migración WatermelonDB porque el cliente no tiene almacén local. Por eso el resumen del perfil todavía no lee los estados del celular.
- T004-66: falta el test con la regla de aptitud de 006, porque ese módulo no existe.
- Las lápidas de 003 no cubren `justificaciones_estado`. Una fila borrada por retiro de consentimiento sale del dispositivo recién en el siguiente pull de reemplazo.
