# 009 - Adopción de Spec-Driven Development (SDD) para Guiar la Generación y Verificación de Código

- Status: accepted
- Date: 2026-10-10
- Tags: proceso arquitectura calidad

## Contexto y problema

Al delegar la generación de código boilerplate, migraciones de bases de datos locales y funciones serverless a herramientas de IA diversas (abiertas, propias o propietarias), existe el riesgo de alucinaciones sintácticas, divergencia de contratos entre frontend/backend y lógica inconsistente. Se requiere un enfoque en el cual la fuente de verdad sean especificaciones formales previas a la generación de código.

## Opciones consideradas

- Code-first asistido por IA (escribir prompts libres y corregir el código resultante iterativamente).
- Spec-Driven Development (definir especificaciones OpenAPI, esquemas de bases de datos y contratos de tipos antes de generar código o pruebas).

## Decisión

Se adopta Spec-Driven Development (SDD) como metodología estándar:

1. Ningún componente, endpoint o esquema de base de datos se implementa con IA sin contar previamente con su especificación validada (OpenAPI, esquemas de WatermelonDB/SQLite, o contratos TypeScript).
2. Los prompts para las herramientas de IA abiertas o propias deben alimentar la especificación como contexto base estricto.
3. Los tests de contrato y suites de validación contra los esquemas se ejecutan en CI para garantizar que el código cumpla la especificación.

### Consecuencias positivas

- Garantiza coherencia entre cliente offline y servicios cloud sin importar el modelo de IA utilizado.
- Facilita pruebas automáticas de regresión y validación de esquemas.

### Consecuencias negativas

- Requiere una inversión de tiempo inicial en el diseño y revisión de especificaciones antes de codificar.

## Enlaces

- Relacionado con [008 - Adopción de Herramientas IA Abiertas/Propias y Spec-Driven Development en Reemplazo del Uso Exclusivo de Claude Code](20261010-herramientas-abiertas-de-ia-para-generacion-de-codigo.md)