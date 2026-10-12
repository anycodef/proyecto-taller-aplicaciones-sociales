# 011 - Identidad propia por enlace y PIN local

- Status: accepted
- Date: 2026-10-11
- Tags: seguridad identidad backend mobile

## Contexto y problema

RF-101, RF-110–RF-112 prohíben exigir correo/teléfono y requieren desbloquear sin red. El C4 describía contraseñas servidor. El usuario acepta las decisiones del plan 001 en backend/001-003.

## Opciones consideradas

- Proveedor externo con correo/SMS: añade identidad obligatoria y costo por usuario/mensaje.
- PIN o contraseña verificados en servidor: impide desbloqueo offline.
- Enlace revocable de alta entropía y PIN local para equipo; enlace para familia.

## Decisión

Se adopta D-101–D-106, D-117–D-119 del plan 001. Token de enlace de 32 bytes aleatorios, solo SHA-256 almacenado, fragmento `#t=` sin cuerpos en logs. Equipo activa en dispositivo; PIN 4–6 dígitos, sal y verificador en SecureStore, cinco fallos bloquean localmente. **Servidor nunca recibe PIN ni contraseña.** JWT corto y renovación rotatoria; autorización consulta cuenta/credencial/rol/delegación/alcance en cada petición. Sesión operativa offline 14 días; reconexión renueva antes del push. Familia usa enlace sin vencimiento automático hasta revocación/cierre aplicable, sesión web en memoria.

## Consecuencias

Revocación efectiva en siguiente interacción servidor; pendientes revocados se rechazan con conteo para coordinación. Dispositivo perdido exige reemisión. Familia acepta el riesgo funcional de enlace reenviado. Activación, cuentas/enlaces/delegación son ONLINE (ADR 013). El App Link, recepción del fragmento, bloqueo en dispositivo y sesión compartida requieren evidencia física; este ADR no acredita implementación.

## Enlaces

- [Spec y plan 001](../../specs/001-acceso-y-roles/plan.md)
- [Contratos frontend](../backend-contratos.md)
- Refina [ADR 005 Zero Trust](20260914-zero-trust-para-proteccion-de-datos-de-menores.md) sin reescribirlo.
