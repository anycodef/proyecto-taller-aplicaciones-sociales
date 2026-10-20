# Prompt P5 — Integración, base de datos, pruebas y evidencia

Sigue primero `docs/tarea-3/prompts/_comun.md`.

**Eres P5 y abres el trabajo: los demás dependen de tu hito 1.** Rama: `tarea3/p5-integracion`. Directorio propio: `tarea3/{package.json,tsconfig.json,compartido,bd,scripts,pruebas-e2e,evidencia}`, `scripts/verificar-cobertura-rf.mjs` (solo para escanear `tarea3/`), `docs/tarea-3/ejecutar.md`, `docs/tarea-3/evidencia.md`.
**Tareas:** T009-51 a T009-60.

Orden obligatorio (hito 1, publícalo cuanto antes en un PR pequeño):
1. T009-51 `tarea3/package.json` (scripts `demo`, `test`, `token`, `bd:subir`, `bd:sembrar`, `typecheck`; dependencias de plan §3, versiones exactas con ≥ 2 semanas de antigüedad). Usa `node --test` con `tsx`. Comprueba que `package.json` raíz no cambia.
2. T009-52/53 migración y siembra del esquema `demo_tarea3` (plan §4), reutilizando PostgreSQL de `api/docker-compose.yml` (puerto `PUERTO_POSTGRES`, 55432 por defecto). Datos 100 % ficticios con `identidadOperativa`; siembra casos BAJO/MEDIO/ALTO.
3. T009-54 `compartido/riesgo.ts`, T009-55 `compartido/auth.ts` (JWT HS256 con `jose`; funciones `emitirToken`, `verificarToken`, `puedeLeerGrupo`, `puedeEscribir`), T009-56 `compartido/bd.ts`.

Después (hitos 3–4):
- T009-57 cobertura de RF sobre `tarea3/`; T009-58 `scripts/demo.mjs` (un comando levanta BD, migra, siembra, arranca ambos servicios, espera salud y corre el recorrido imprimiendo cada paso); T009-59 e2e real: consulta GraphQL → mutación que pasa por gRPC → la consulta refleja el cambio → lote → streaming.
- T009-60 `docs/tarea-3/ejecutar.md` y `docs/tarea-3/evidencia.md`: tabla «viñeta del profesor → artefacto → comando → log/captura → commits». Guarda salidas **reales** en `tarea3/evidencia/` (no inventes). Pide a alguien que no escribió esto que reproduzca con solo `ejecutar.md`.

Al final verifica que `npm test`, `npm run typecheck`, `npm run lint`, `npm --prefix tarea3 test` y `node scripts/verificar-cobertura-rf.mjs` pasen, e informa honestamente lo que no se pudo correr.
