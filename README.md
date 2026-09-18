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
| PWA mobile-first | El equipo ya vive en el celular. Instalar una app nativa es un paso mas. |
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
guardan el razonamiento, las opciones descartadas y los cambios de rumbo — por
ejemplo, el ADR 008 revierte la elección de React Native del ADR 001 y vuelve a
la PWA.

```bash
npm run adr:preview   # sitio navegable en local
npm run adr:new       # crear un ADR
```

## Estructura

```
src/
  app/
    asistencia/      Pantalla del catequista: pasar lista
    coordinacion/    Panel del ciclo: asistencia, justificaciones, riesgo
    familia/         Perfil del propio hijo y envio de justificaciones
    manifest.ts      Manifest de la PWA
  components/        Componentes compartidos de interfaz
  lib/
    domain/          Modelo de datos y reglas de acceso por rol
    offline/         Cola de sincronizacion diferida
public/
  sw.js              Service worker (cascaron cache-first)
docs/
  adr/               Registros de decisiones de arquitectura (Log4brains)
  diagrams/          Modelo C4 en Structurizr DSL (C1 a C3)
```

## Stack

- Next.js 16 (App Router) con React 19
- TypeScript
- Tailwind CSS v4
- Despliegue en Vercel (funciones serverless)

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Estado

Fase 2 cerrada: modelo de dominio, control de acceso, cola de sincronizacion y
cascaron PWA. Las pantallas por rol tienen ruta y alcance definidos; su
implementacion corresponde al prototipado de la Fase 3.

Pendiente de decidir antes de la Fase 3: proveedor de base de datos,
autenticacion y almacenamiento de archivos para los adjuntos de justificacion.

## Equipo

- Bruno Pumapillo Sarmiento
- Pedro Josue Sota Rios
- Calderon Matias Diego Alonso
- Espinoza Aponte Wilson Fabrizzio
- Montenegro Cajahuaman Carlos Andres
