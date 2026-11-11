# SIGECAT

Sistema Integrado de Gestion y Seguimiento Catequetico Parroquial: registro de
asistencia, justificaciones y seguimiento del avance sacramental de
catequizandos, disenado para operar sin conexion desde el celular.

Trabajo del curso **Taller de Aplicaciones Sociales** — Universidad Nacional
Mayor de San Marcos, Facultad de Ingenieria de Sistemas e Informatica, E.P. de
Ingenieria de Software. Docente: Cordero Sanchez, Hugo R.

Este repositorio corresponde a la **Fase 2** del Design Thinking del proyecto:
la inicializacion del codigo sobre la propuesta arquitectonica ya validada en
el trabajo de campo.

## El problema

La coordinadora de catequesis dedica el domingo completo mas la preparacion de
la semana al programa. De todas sus tareas, la unica que pidio explicitamente
quitarse de encima es **la asistencia y las justificaciones**. Su miedo central
es que el trabajo del ano se pierda: los ninos dejan de venir apenas reciben la
comunion.

El equipo ya abandono dos herramientas por falta de tiempo — subir la
asistencia a Drive y el rol de revisor de notificaciones. Esa es la restriccion
que manda: **cualquier herramienta que agregue pasos sera abandonada.**

## Decisiones de arquitectura

| Decision | Por que |
| --- | --- |
| App movil multiplataforma (React Native + Expo) | El equipo ya vive en el celular y el parque de dispositivos es heterogeneo. Una sola base de codigo para Android e iOS. |
| Offline-first | En el local la senal no llega del primer al tercer piso. Pasar lista no puede depender de la red. |
| Cola de sincronizacion desacoplada | El envio diferido nunca bloquea el registro; los reintentos son problema de la cola, no de la catequista. |
| Backend serverless | Sin costo de infraestructura por usuario, sostenible para una parroquia. |
| Permisos a nivel de dato | Cada catequista ve solo su grupo; cada familia, solo su propio hijo. No basta con ocultar pantallas. |
| OCR y riesgo de desercion asincronos | Corren fuera del camino critico: no agregan latencia al pase de lista. |
| Sin biometria | Se descarta reconocimiento facial: implicaria procesar datos biometricos de menores de edad. |

Sobre esa base se aplican principios de **minimizacion y retencion de datos de
menores**, con captura de consentimiento informado en la inscripcion.

## Decisiones registradas

Las decisiones de arquitectura viven en [`docs/adr`](docs/adr) como ADRs
gestionados con Log4brains. La tabla de arriba resume el resultado; los ADRs
guardan el razonamiento, las opciones descartadas y los cambios de rumbo. El
modelo C4 (contexto, contenedores y componentes) esta en
[`docs/diagrams`](docs/diagrams) en Structurizr DSL.

```bash
npm run adr:preview   # sitio navegable en local
npm run adr:new       # crear un ADR
```

## Especificaciones

El comportamiento acordado de las specs 001 a 008 está en
[`openspec/specs`](openspec/specs). La spec 009 evaluó GraphQL, gRPC y MCP
para el taller: no forman parte del producto. El transporte sigue siendo REST,
con sincronización WatermelonDB.

`specs/` conserva el plan, las tareas y las dudas abiertas. Mientras
`docs/constitution.md` no cambie, esa carpeta sigue siendo la fuente. El
trabajo nuevo no se escribe ahí: se abre como un cambio.

Quien usa OpenCode (plan Go incluido) trabaja con los comandos de
[`.opencode/commands`](.opencode/commands). Hace falta el CLI de OpenSpec en
la máquina (`npm install -g @fission-ai/openspec@latest`, Node 22.12 o mayor).

```text
/opsx-explore     pensar el cambio, sin implementar
/opsx-propose     proposal, delta, design y tasks; se detiene antes del código
/opsx-apply       implementar las tareas del cambio
/opsx-archive     fusionar los requisitos en openspec/specs y archivar
```

## Estructura

```
src/
  app/               Rutas de Expo Router (una pantalla por archivo)
    _layout.tsx      Stack raiz
    index.tsx        Portada con los accesos por rol
    asistencia.tsx   Catequista: pasar lista
    coordinacion.tsx Coordinacion: asistencia, justificaciones, riesgo
    familia.tsx      Familia: perfil del propio hijo y justificaciones
  components/        Componentes compartidos de interfaz
  lib/
    domain/          Modelo de datos y reglas de acceso por rol
    offline/         Cola de sincronizacion diferida
assets/images/       Icono, splash y capas adaptativas de Android
app.json             Configuracion de Expo (nombre, esquema, iconos, plugins)
docs/
  adr/               Registros de decisiones de arquitectura (Log4brains)
  diagrams/          Modelo C4 en Structurizr DSL (C1 a C3)
openspec/            Comportamiento vigente (specs 001–008) y cambios en curso
.opencode/           Comandos y skills de OpenSpec para OpenCode
```

## Stack

- React Native 0.86 sobre Expo SDK 57, con Expo Router para la navegacion
- TypeScript estricto con rutas tipadas
- ESLint con `eslint-config-expo`
- Backend modular Azure Functions v4, Node.js 22 y TypeScript: seguridad, inscripciones, perfiles, asistencia y sincronización
- PostgreSQL 16 con SQL explícito y migraciones inmutables; Blob Storage privado para retención de evidencias
- Infraestructura Bicep y workflows con OIDC; contrato [OpenAPI 3.1](api/openapi.json)

## Desarrollo

```bash
npm install
npm start          # servidor de desarrollo; escanear el QR con Expo Go
npm run android    # abrir en emulador o dispositivo Android
npm run ios        # abrir en simulador iOS (solo macOS)
npm run web        # vista previa en el navegador
npm run typecheck
npm run lint
```

## Estado

El comportamiento de 001–008 está publicado en `openspec/specs`. GraphQL, gRPC y MCP quedaron como evaluación del taller (spec 009) y no se implementan en el producto.

El backend de las specs 001–003 está implementado en `backend/001-003`, con soporte mínimo transversal de ciclos y actividades. La guía de ejecución y roles está en [docs/backend-desarrollo.md](docs/backend-desarrollo.md); el contrato para integrar frontend, en [docs/backend-contratos.md](docs/backend-contratos.md). Las comprobaciones locales y los pendientes de despliegue, interfaz y specs posteriores se registran en [docs/backend-implementacion.md](docs/backend-implementacion.md). El siguiente corte de producto es la lista de asistencia en el celular (spec 003), no un protocolo nuevo.

Fase 2 cerrada: modelo de dominio, control de acceso por cuatro roles, cola de
sincronizacion y aplicacion Expo con una pantalla de entrada por rol. Las
pantallas tienen ruta y alcance definidos; su implementacion corresponde al
prototipado de la Fase 3.

Pendiente antes de la Fase 3, en el orden en que bloquean:

1. WatermelonDB sobre SQLite como repositorio local (requiere build de
   desarrollo; no funciona en Expo Go).
2. Proveedor de identidad externo y almacenamiento seguro de tokens
   (`expo-secure-store`).
3. Desplegar el backend y PostgreSQL con la configuración Azure/OIDC, y conectar los adjuntos de la spec 004.
4. Punto de entrada web minimo para que los padres justifiquen por enlace sin
   instalar la app.

## Equipo

- Bruno Pumapillo Sarmiento
- Pedro Josue Sota Rios
- Calderon Matias Diego Alonso
- Espinoza Aponte Wilson Fabrizzio
- Montenegro Cajahuaman Carlos Andres
