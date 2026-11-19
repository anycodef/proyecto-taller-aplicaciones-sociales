# Plan 012 — Despliegue en Azure, monitoreo y conexión de pantallas

## 1. Punto de partida (2026-11-11)

- **Infraestructura:** el Bicep de la spec 001 compila con Bicep 0.48.1 y sus 9
  pruebas de plantilla pasan. Nunca se ha desplegado: no existe el entorno `prod`
  en GitHub ni la identidad OIDC, y `despliegue.yml` no se ha ejecutado.
- **CI:** el de `main` falla desde el 2026-10-26 por dos causas:
  - ESLint revisa `tarea3/` sin sus dependencias instaladas (47 errores
    `import/no-unresolved`).
  - `npm run lint --prefix api` ejecuta ESLint con `api/` como directorio de
    trabajo y los globs de `eslint.config.js` no coinciden (10 errores, H-01).
  - `despliegue.yml` exige CI verde y además ejecuta ese segundo comando.
- **Web:** `expo export --platform web` produce 2,2 MB estáticos. Nada genera el
  artefacto `frontend-web` que espera `despliegue-web.yml`.
- **APIM:** los productos `app-movil` y `web-familias` exigen suscripción con
  aprobación y la plantilla no crea suscripciones.
- **Pantallas:**

| Spec | API | Pantallas |
|---|---|---|
| 003 | En `main` | Rama `frontend-001_003` (Diego), sin unir; pasa tipos, lint y tests unida a `main` |
| 004 | No existe | No existen |
| 007 | `GET /riesgo` en `main` | No existen |

## 2. Decisiones

| Id | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| D-1201 | Identidad administrada asignada por el usuario con credencial federada | Registro de aplicación en Entra | Las suscripciones de crédito educativo suelen impedir registrar aplicaciones en el inquilino universitario. La identidad administrada solo requiere permisos sobre la suscripción y `azure/login` la admite igual. La guía documenta la alternativa. |
| D-1202 | El job web vive en `ci.yml`, depende de `verificar` y solo corre si `ci.yml` es el workflow raíz | Workflow aparte con `workflow_run` | Mantiene el origen que ya valida `despliegue-web.yml`. Cuando `despliegue.yml` reutiliza `ci.yml`, el contexto `github` pertenece al llamador, así que se distingue por `github.workflow_ref`. |
| D-1203 | Clave de `web-familias` en un secreto del repositorio | Variable del repositorio | La clave termina en el JavaScript público, pero como secreto no aparece en los registros del CI. La protección real es el JWT y los límites por suscripción y por cuenta. |
| D-1204 | Verificación posterior y ensayo de caída en Node sin dependencias | Bash con `curl` | Se prueban con servidores locales y un doble de `az`; `fetch` y `node:test` ya existen en Node 22. |
| D-1205 | Registro de módulos en `src/lib/navegacion/` (TS puro) | Cambiar enlaces a mano en cada pantalla | Un solo lugar, verificable con pruebas: no hay enlaces rotos y la visibilidad sale de la misma matriz de permisos que usa la API. |
| D-1206 | No se agregan enlaces a la lista `OPCIONES` de `coordinacion.tsx` | Reescribir esa lista | La rama de Diego modifica `OPCIONES`; los módulos se pintan en una sección propia para que su unión no tenga conflictos. |
| D-1207 | El primer despliegue se ejecuta con `solo_plan=false` | Empezar por un what-if | `desplegar.py` exige una bóveda y el secreto `bd-clave-administracion` para el modo plan. La revisión previa se hace con el what-if local de `preparar-azure.sh` y con la aprobación del entorno `prod`. |

## 3. Archivos

| Archivo | Contenido | RF |
|---|---|---|
| `.github/workflows/ci.yml` | Instala `tarea3`; job `web` que publica `frontend-web`; pruebas de infraestructura | RF-1201, RF-1202 |
| `.github/workflows/despliegue.yml` | Instala `tarea3` | RF-1201 |
| `.github/workflows/despliegue-web.yml` | Exige que el artefacto venga de `ci.yml` | RF-1202 |
| `api/package.json` | `lint` lanzado desde la raíz | RF-1201 |
| `infra/scripts/verificar-despliegue.mjs` | Verificación posterior (CLI y módulo) | RF-1203, RNF-1202 |
| `infra/scripts/ensayo-caida.mjs` | Ensayo de caída con evidencia JSON | RF-1204, RNF-1202 |
| `infra/scripts/preparar-azure.sh` | Preparación única de Azure y GitHub; `--simular` y `--what-if` | RF-1205, RNF-1202 |
| `api/pruebas/infra/despliegue.test.mjs` | Pruebas de los workflows y los scripts | RF-1201 a RF-1205, RNF-1201, RNF-1202 |
| `src/lib/navegacion/modulos.ts` | Registro de módulos por panel | RF-1206 |
| `src/lib/navegacion/__tests__/modulos.test.ts` | Rutas existentes, permisos y visibilidad | RF-1206 |
| `src/app/(equipo)/coordinacion.tsx`, `src/app/(familia)/familia.tsx` | Pintan el registro | RF-1206 |
| `docs/despliegue-azure.md` | Guía de despliegue, verificación, ensayo y recorrido | RNF-1201 |

## 4. Recorrido completo (aceptación de la integración)

1. Administración crea las cuentas de coordinación, catequista y familia (001).
2. El catequista pasa lista y marca una ausencia; el registro se sincroniza (003).
3. La familia ve la ausencia y envía la justificación con foto (004).
4. Coordinación aprueba la justificación (004).
5. La lista de riesgo deja de contar esa falta (007).

Los pasos 3 a 5 dependen de pantallas que aún no existen. La guía mantiene este
recorrido como lista de comprobación, que se ejecutará contra la web publicada
cuando cada módulo se marque como disponible.

## 5. Riesgos

- **Región:** la política de la suscripción de estudiante puede no permitir
  `eastus2` o Functions Flex. `preparar-azure.sh` lo comprueba antes de crear nada.
- **Costo:** APIM, Functions, PostgreSQL B1ms y las pruebas estándar de
  disponibilidad consumen crédito. El presupuesto de US$5 avisa, pero no detiene
  nada.
- **Aprobación de despliegues:** con revisores obligatorios y «impedir
  autoaprobación», otra persona tiene que aprobar cada despliegue.
- **Ensayo de caída:** detiene la API. Se ejecuta en una ventana acordada con el
  equipo (T001-156).
