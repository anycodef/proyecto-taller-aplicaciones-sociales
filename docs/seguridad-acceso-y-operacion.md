# Acceso, autorización y entrega a operación

Revisión de Adrian Palacios, 2026-11-09. Base: spec 001, RF-101/102/111/112,
T001-33/35/50/78–81/84/93; spec 003, T003-46/48/50/63/110.
Esta evidencia no cierra tareas de despliegue. La ampliación RNF-106 de spec 001
fue autorizada por el usuario el 2026-11-09 y se mantiene también en OpenSpec.

## Cambios verificados localmente

- Restaurar una credencial del equipo no desbloquea la aplicación: requiere PIN.
- El desbloqueo actualiza el contexto de presentación; tras 14 días permite
  consulta después de verificar PIN, no renueva por sí solo la ventana operativa.
  Atrasar el reloj no recupera días de registro.
- Las rutas administrativas se filtran por rol. Una cuenta del equipo con rol
  familia puede acceder también a la vista de familia. La coordinación delegada
  no puede volver a delegar.
- El pull de asistencia comprueba autorización también en el caso de uso y no
  entrega correcciones propias de niños que ya están fuera del alcance actual.
  Inscripción y asignación deben estar vigentes temporalmente.
- Los rechazos de push por autoría, rol, registro manual ajeno o corrección sin
  permiso dejan auditoría transaccional, sin guardar el contenido del registro.
- Las regresiones cubren supervisión de solo lectura, unión catequista/familia,
  datos de un tercero y diferencias entre permiso de estado y de evidencia.

Las guardas del cliente no sustituyen la autorización del servidor. El modo
consulta debe respetarse en las escrituras de las futuras pantallas de asistencia;
esta entrega no implementa esas pantallas ni su persistencia offline.

## Límites de 004 y 007

Este checkout aún no contiene módulos API de justificaciones ni riesgo. Las
pruebas de permisos compartidos de justificaciones y el rechazo de colecciones
no implementadas no acreditan la seguridad de endpoints futuros. Al integrarlos:

1. Cargar cuenta activa, roles, delegación y alcance desde servidor en cada petición.
2. Autorizar el recurso concreto antes de consultar o modificarlo, incluidas
   evidencia, exportaciones y consultas por identificador directo.
3. Probar grupo propio/ajeno, hijo propio/ajeno, unión de roles y supervisión
   según el permiso específico de la spec; no concederle permisos de riesgo
   por analogía con asistencia.
4. Probar revocación de enlace, desactivación y vencimiento/revocación de delegación.
5. No persistir evidencias ni datos restringidos en el dispositivo ni en logs.

## Coordinación con Pedro para Azure

La configuración existente en `infra/README.md` y los módulos Bicep requiere
comprobación real después del despliegue:

- Functions sin acceso público a handlers sin clave de host; APIM valida JWT,
  emisor, audiencia, expiración y algoritmo. La autorización por dato sigue en API.
- Roles PostgreSQL separados para migración y ejecución; secretos en Key Vault,
  permisos por identidad y rotación JWT coordinada con la clave anterior.
- HTTPS, origen CORS de la web de producción y contenedores privados.
- Diagnóstico APIM sin cuerpos/cabeceras; Application Insights con muestreo y
  cuota diaria, sin datos personales ni credenciales.
- Verificar 401 sin credencial, rechazo de acceso ajeno con credencial válida,
  supervisión sin escritura y revocación en la siguiente petición. Usar cuentas
  sintéticas, nunca datos de menores, y conservar resultado sin tokens.

No se ejecutaron despliegue, consultas contra Azure ni simulaciones de caída.

## Disponibilidad aprobada e implementada — RNF-106

La spec 001, su plan/tareas y la versión OpenSpec incluyen ahora RNF-106.
T001-154/155 tienen implementación local; T001-156 requiere evidencia externa.

- Function `GET estado`, protegida por clave de host: SELECT 1, respuesta mínima
  200/503 no-store, sin datos personales, secretos ni errores internos.
- API técnica APIM independiente `GET /estado/`, sin credencial personal ni
  suscripción, hereda clave de host y normaliza errores del origen/transporte.
  No se quita autenticación ni suscripción de `/v1`.
- Prueba estándar cada 5 minutos desde tres ubicaciones; TLS, HTTP 200 y contenido
  esperado, sin seguir redirecciones. Alerta con dos ubicaciones fallidas,
  evaluación cada minuto/ventana cinco minutos y recuperación automática.
- Correo operativo configurable con `CORREO_ALERTAS`; por defecto usa responsable
  de presupuesto. No hay tokens de usuario en la sonda ni SMS.

Procedimiento de despliegue, coste, riesgo de abuso del endpoint público y ensayo
controlado en `infra/README.md`. No se han desplegado estos cambios ni probado
la recepción real del correo; no debe declararse terminada la verificación Azure.

## Validación local

- `BD_PRUEBAS_URL=postgres://postgres:postgres@localhost:55432/postgres npm test`:
  80 tests cliente y 204 API aprobados, incluida integración PostgreSQL.
  La URL corresponde exclusivamente al PostgreSQL local de pruebas del compose.
- `npm run typecheck`: aprobado en raíz y API.
- `npm run lint`: aprobado.
- Bicep v0.48.1: compilación aprobada y 9 pruebas de plantilla aprobadas.
- Verificación OpenAPI: aprobada, 66 operaciones.
- `git diff --check`: aprobado antes del registro documental.
- `npm --prefix api run build`: falla en Windows al resolver alias como
  `/C:/Users/.../src/lib/...`. La configuración de build no fue modificada por
  esta entrega; queda pendiente corregir su portabilidad antes de publicar.

La primera ejecución de `npm test` sin `BD_PRUEBAS_URL` falló al preparar API;
se repitió completa con la variable explícita y terminó correctamente.
El cliente emite un aviso de `act(...)` en `fijar-pin.test.tsx` sin fallar tests.
