# Tareas — Despliegue en Azure, monitoreo y conexión de pantallas

- [ ] **T012-01** — Dejar el CI en verde: instalar `tarea3` en `ci.yml` y
  `despliegue.yml` y lanzar el lint de `api` desde la raíz (RF-1201). Hecho
  cuando: la prueba RF-1201 pasa, el lint pasa desde la raíz y desde `api/`, y el
  CI remoto de `main` termina en verde.
- [ ] **T012-02** — Publicar el artefacto `frontend-web` desde `ci.yml` y restringir
  `despliegue-web.yml` a ese origen (RF-1202). Hecho cuando: la prueba RF-1202
  pasa, `actionlint` no informa errores y una ejecución en `main` sube el artefacto.
- [ ] **T012-03** — Escribir la verificación posterior al despliegue (RF-1203,
  RNF-1202). Hecho cuando: las pruebas con servidores locales detectan cada fallo
  y no imprimen la clave.
- [ ] **T012-04** — Escribir el ensayo de caída (RF-1204, RNF-1202). Hecho cuando:
  la prueba con un doble de `az` registra los hitos en orden y reinicia la Function
  App también ante error.
- [ ] **T012-05** — Escribir la preparación única de Azure y GitHub (RF-1205,
  RNF-1202). Hecho cuando: la prueba en modo simulación muestra la credencial
  federada solo para `environment:prod`, los roles sin Owner y el entorno `prod`.
- [ ] **T012-06** — Escribir la guía de despliegue (RNF-1201). Hecho cuando: la
  prueba confirma sus secciones y que existe cada script citado.
- [ ] **T012-07** — Conectar 003, 004 y 007 desde un registro único de módulos
  (RF-1206). Hecho cuando: las pruebas de rutas, permisos y visibilidad pasan y
  los paneles de coordinación y familia lo usan.
- [ ] **T012-08** — Ejecutar el despliegue real **[Requiere cuenta externa]**
  (RF-1203, T001-26). Hecho cuando: `despliegue.yml` termina en verde y
  `verificar-despliegue.mjs` pasa contra la API y la web publicadas.
- [ ] **T012-09** — Ejecutar el ensayo de caída en Azure **[Requiere cuenta
  externa]** (RF-1204, T001-156). Hecho cuando: hay evidencia con las horas de
  caída, alerta, correo recibido, recuperación y resolución.
- [ ] **T012-10** — Recorrido completo en la web publicada (RF-1206). Depende de
  las pantallas de 004 y 007. Hecho cuando: los cinco pasos del plan §4 se
  completan con datos sintéticos.
