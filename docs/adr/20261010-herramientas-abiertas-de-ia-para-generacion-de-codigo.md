# 008 - Adopción de herramientas abiertas de IA para generación de código asistido por especificaciones

- Status: accepted
- Date: 2026-10-10
- Tags: herramientas proceso

## Context and Problem Statement

El equipo venía utilizando exclusivamente Claude Code según lo establecido en el ADR-007. Sin embargo, depender de una única herramienta propietaria introduce riesgos de bloqueo de proveedor (vendor lock-in), costos recurrentes y limitaciones de cuota.

## Opciones consideradas

- Mantener la dependencia exclusiva de Claude Code (ADR-007).
- Migrar a herramientas y modelos abiertos/propios de IA (Open Code, modelos locales/autoalojados o CLI abiertas) respaldados por Spec-Driven Development (SDD).

## Decision

Se amplía el soporte a herramientas abiertas y de despliegue propio de IA en el flujo de desarrollo, revocando la exclusividad de Claude Code.

- Cada desarrollador puede emplear herramientas abiertas de asistencia (Open Code o agentes abiertos), siempre que el output cumpla con los estándares arquitectónicos del proyecto.
- Toda generación de código asistida por IA debe regirse por los contratos, tipos y esquemas definidos formalmente bajo la metodología adoptada en el ADR relacionado de Spec-Driven Development.
- Se mantiene el principio de revisión obligatoria por al menos dos miembros antes de integrar cualquier Pull Request.

### Consecuencias positivas

- Elimina el vendor lock-in y optimiza costos al permitir inferencia local o herramientas de código abierto.
- Mayor flexibilidad para que cada integrante utilice el entorno que mejor se ajuste a su máquina o cuotas disponibles.
- Menor desalineación en el código generado gracias a las especificaciones formales previas.

### Consecuencias negativas

- Variabilidad potencial en el estilo de código generado según el modelo subyacente, lo cual requiere reforzar linters, validaciones de tipos automáticas y las suites de pruebas unitarias.

## Enlaces

- Supersedes [007 - Adopción de Claude Code como Herramienta IA para Acelerar la Generación de Código Crítico](20260914-claude-code-como-herramienta-ia-de-desarrollo.md)
- Relacionado con [009 - Adopción de Spec-Driven Development (SDD)](20261010-spec-driven-development-generacion-codigo.md)
- Aplica sobre [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md) y [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md)