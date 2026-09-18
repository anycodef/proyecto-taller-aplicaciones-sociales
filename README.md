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
```

## Stack

- React Native 0.86 sobre Expo SDK 57, con Expo Router para la navegacion
- TypeScript estricto con rutas tipadas
- ESLint con `eslint-config-expo`

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

Fase 2 cerrada: modelo de dominio, control de acceso por cuatro roles, cola de
sincronizacion y aplicacion Expo con una pantalla de entrada por rol. Las
pantallas tienen ruta y alcance definidos; su implementacion corresponde al
prototipado de la Fase 3.

Pendiente antes de la Fase 3, en el orden en que bloquean:

1. WatermelonDB sobre SQLite como repositorio local (requiere build de
   desarrollo; no funciona en Expo Go).
2. Proveedor de identidad externo y almacenamiento seguro de tokens
   (`expo-secure-store`).
3. Backend serverless, PostgreSQL y servicio de objetos para los adjuntos.
4. Punto de entrada web minimo para que los padres justifiquen por enlace sin
   instalar la app.

## Equipo

- Bruno Pumapillo Sarmiento
- Pedro Josue Sota Rios
- Calderon Matias Diego Alonso
- Espinoza Aponte Wilson Fabrizzio
- Montenegro Cajahuaman Carlos Andres
