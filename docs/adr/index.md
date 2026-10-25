<!-- This file is the homepage of your Log4brains knowledge base. You are free to edit it as you want -->

# Architecture knowledge base

## Acuerdos backend 001–003 aceptados (2026-10-11)

- [011 — Enlace y PIN local](20261011-identidad-propia-enlace-pin-local.md)
- [012 — Marcas inmutables y contratos](20261011-marcas-inmutables-y-contratos-sincronizacion.md), transporte sustituido por ADR 015.
- [013 — Excepción administrativa ONLINE y retención](20261011-excepcion-administrativa-online-y-retencion.md), sustituye ADR 002 y 010.
- [014 — Servidores Azure Flex](20261011-configuracion-servidores-azure-flex.md), sustituye ADR 004.
- [015 — Transporte nativo WatermelonDB](20261011-transporte-nativo-watermelondb.md), conserva claves nativas HTTP; adaptación interna opcional.

Decisiones aceptadas no equivalen a implementación verificada. [Seguimiento](../backend-implementacion.md) · [Contratos frontend](../backend-contratos.md).

## Tarea 3 — GraphQL, gRPC y MCP (2026-10-19)

- [016 — GraphQL en el borde de consulta, gRPC interno y MCP para agentes](20261019-graphql-grpc-mcp.md)

Welcome 👋 to the architecture knowledge base of proyecto-taller-aplicaciones-sociales.
You will find here all the Architecture Decision Records (ADR) of the project.

## Definition and purpose

> An Architectural Decision (AD) is a software design choice that addresses a functional or non-functional requirement that is architecturally significant.
> An Architectural Decision Record (ADR) captures a single AD, such as often done when writing personal notes or meeting minutes; the collection of ADRs created and maintained in a project constitutes its decision log.

An ADR is immutable: only its status can change (i.e., become deprecated or superseded). That way, you can become familiar with the whole project history just by reading its decision log in chronological order.
Moreover, maintaining this documentation aims at:

- 🚀 Improving and speeding up the onboarding of a new team member
- 🔭 Avoiding blind acceptance/reversal of a past decision (cf [Michael Nygard's famous article on ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html))
- 🤝 Formalizing the decision process of the team

## Usage

This website is automatically updated after a change on the `main` branch of the project's Git repository.
In fact, the developers manage this documentation directly with markdown files located next to their code, so it is more convenient for them to keep it up-to-date.
You can browse the ADRs by using the left menu or the search bar.

The typical workflow of an ADR is the following:

![ADR workflow](/l4b-static/adr-workflow.png)

The decision process is entirely collaborative and backed by pull requests.

## More information

- [Log4brains documentation](https://github.com/thomvaill/log4brains/tree/develop#readme)
- [What is an ADR and why should you use them](https://github.com/thomvaill/log4brains/tree/develop#-what-is-an-adr-and-why-should-you-use-them)
- [ADR GitHub organization](https://adr.github.io/)
