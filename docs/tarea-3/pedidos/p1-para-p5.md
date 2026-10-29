# Pedido de P1 a P5 (integración y evidencia)

P1 necesita cerrar T009-15 y T009-17 con evidencia real de la demo. Cuando P2,
P3 y P4 estén integrados, por favor entrega en `tarea3/evidencia/`:

1. La medición de la misma pregunta por GraphQL y gRPC, con bytes de solicitud y
   respuesta y número de llamadas. Si gRPC no puede responder sin una escritura,
   documenta esa limitación con el contrato congelado.
2. La salida real de `npm --prefix tarea3 run demo` (código de salida 0).
3. La salida de `npm --prefix tarea3 test` y de `node scripts/verificar-cobertura-rf.mjs`.
4. El mapa de `docs/tarea-3/evidencia.md`: viñeta del profesor → artefacto →
   comando → log/captura → commits.
5. Una revisión de que la matriz de P1 no contradice la implementación: si P2/P3
   usan GraphQL o gRPC en un lugar que la matriz marca como «no», avísame antes
   del merge.

P1 no puede ejecutar `npm --prefix tarea3 test` en su rama mientras la base de P5
no esté en `main`; por eso la evidencia de P1 se limita a documentos y a la
medición de contratos hasta que P5 integre.
