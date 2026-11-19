# Spec 012 — Despliegue en Azure, monitoreo y conexión de pantallas

## Alcance autorizado

Encargo del equipo, pedido expresamente por el usuario el 2026-11-11: subir la API
y la web a Azure, configurar la base de datos, comprobar la seguridad y el
monitoreo, verificar que una caída de la API se detecta y avisa, y conectar las
pantallas de 003 (asistencia), 004 (justificaciones) y 007 (riesgo) para dejar el
recorrido completo listo al abrir el sistema.

La infraestructura, los workflows y la alerta ya están definidos en la spec 001
(T001-16 a T001-28, T001-143, T001-144, T001-154 a T001-156). Esta spec no cambia
esa arquitectura, el modelo de datos ni las dependencias: cubre lo que faltaba
para ejecutarla, verificarla y operar la integración.

Las pantallas de 003, 004 y 007 las construyen sus responsables según sus specs.
Esta spec solo define el punto de conexión, no las pantallas.

## Requisitos

- **RF-1201.** El CI deberá revisar con ESLint la raíz, `api` y `tarea3` con sus
  dependencias instaladas, y `npm run lint --prefix api` deberá dar el mismo
  resultado ejecutado desde la raíz o desde `api/`.
- **RF-1202.** Cuando haya un push a `main` y la publicación web esté habilitada,
  el CI deberá exportar la web con la URL pública de la API y la clave del
  producto `web-familias`, incluir `staticwebapp.config.json` y publicar el
  artefacto `frontend-web`. Si falta la URL de la API, el job deberá fallar en vez
  de publicar una web sin API. El workflow de publicación solo deberá aceptar
  artefactos de una ejecución exitosa de ese CI en `main`.
- **RF-1203.** Existirá una verificación posterior al despliegue que compruebe:
  estado técnico 200 con `no-store` y cuerpo mínimo; rechazo 401 de `/v1` sin
  credencial o sin JWT; que la API no responde con éxito por HTTP; CORS solo para
  el origen de la web; cabeceras de seguridad de la web; y que las rutas internas
  de la web cargan. Si algún punto falla, deberá terminar con código distinto de 0.
- **RF-1204.** Existirá un ensayo de caída que detenga la Function App, observe el
  fallo en el estado técnico, espere la alerta disparada de la sonda, reinicie la
  Function App siempre (también ante error o interrupción), espere la
  recuperación y la resolución de la alerta, y guarde las horas UTC de cada hito
  como evidencia.
- **RF-1205.** Existirá una preparación única de Azure y GitHub que cree el grupo
  de recursos, registre los proveedores, cree una identidad con credencial
  federada solo para el entorno `prod` del repositorio, le asigne roles de
  mínimo privilegio en el grupo (sin Owner) y configure el entorno `prod` y sus
  variables en GitHub. Volver a ejecutarla no deberá duplicar recursos.
- **RF-1206.** Los paneles de entrada deberán mostrar los módulos de 003, 004 y
  007 desde un único registro. Un módulo se mostrará como enlace solo si está
  marcado como disponible, su pantalla existe en `src/app` y el rol tiene el
  permiso en `MATRIZ_PERMISOS`. Si no, aparecerá en «Próximamente». Conectar una
  pantalla terminada deberá requerir un único cambio en ese registro.
- **RNF-1201.** La guía de despliegue deberá dar los pasos en orden, con comandos
  exactos, el punto de verificación de cada paso, la reversión, los costos que
  pueden facturarse y quién ejecuta cada paso. Todos los scripts que cite deberán
  existir en el repositorio.
- **RNF-1202.** Ningún script de esta spec deberá imprimir claves, contraseñas,
  cadenas de conexión ni la clave de suscripción. Tampoco se guardará ningún
  secreto en el repositorio.

## Aceptación

Cada requisito tendrá al menos una prueba que cite su identificador. Las pruebas de
los scripts usan servidores locales y dobles de `az` y `gh`, porque no acreditan
un despliegue real. El despliegue, la recepción del correo de alerta y el ensayo
de caída en Azure siguen pendientes de evidencia externa (T001-26 y T001-156) y no
se marcarán hechos con pruebas locales. Se ejecutarán además `npm test`,
`npm run typecheck` y `npm run lint`.
