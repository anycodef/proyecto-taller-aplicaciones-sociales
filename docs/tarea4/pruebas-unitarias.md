# Nuevas Prubas Unitarias para los Módulos de Catequizando y Asistencia

## 1. Suites de Pruebas Implementadas

### Módulo: Catequizando

#### 1. api/test/unit/catequizandos/errores-dominio.test.ts

- RF-201: Normalización ante caracteres de control, saltos
  de línea (\n, \t), espacios múltiples y caracteres Unicode
  con tildes atípicas.
- RF-202: Rechazo de fechas civiles inexistentes (2025-02-29, 2026-04-31), meses fuera de rango (2026-13-01),
  formatos no ISO y fechas de nacimiento posteriores a la
  fecha de referencia.
- RF-202: Rechazo estricto de edades no enteras (7.99, 13.01), NaN, Infinity y límites exteriores al rango permitido
  (8 a 13 años).
- RF-204: Provocación de transiciones ilegales de
  documentos (ej. no_aplica a entregado directo) y omisión
  de motivo obligatorio en invalidación y exoneración.
- RF-205: Rechazo de categorías médicas ajenas a la lista
  cerrada, notas de apoyo que exceden 200 caracteres (201+)
  y duplicidad de categorías en un mismo niño.
- RF-206: Imposibilidad de sugerir grupos cerrados o
  incongruentes por edad/sexo, e impedimento estricto de
  cierre de grupos que contienen niños activos.
- RF-207: Rechazo de vínculos no autorizados (vecino,
  conocido, hermano_menor) y rechazo de detalles de relación
  que superan 100 caracteres.

#### 2. api/test/unit/catequizandos/errores-autorizacion.test.ts

- RF-202: Denegación de gestión de inscripciones para
  roles no autorizados (familia, catequista, supervision,
  administracion) y catequistas con delegación vencida.
- RF-205 / RNF-203: Bloqueo de acceso a condiciones de
  niños pertenecientes a grupos ajenos para catequistas, y
  bloqueo absoluto para familias y supervisión.
- RF-201 / RNF-203: Garantía de proyección mínima para
  cuentas familiares (nunca se entregan apoderados ni
  historial de grupos) y denegación de perfiles ajenos o
  para supervisión.
- RF-202 / RF-206: Rechazo de inyección de campos hostiles
  no permitidos (ej. dni), grupos con rangos invertidos
  (edadMinima > edadMaxima) y listas de documentos con tipos
  repetidos en esquemas Zod estrictos.

---

### Módulo: Asistencia

#### 3. api/test/unit/asistencia/errores-qr-reloj.test.ts

- RF-302 / RF-303: Rechazo de formatos QR malformados:
  prefijos erróneos (sgc1, SGC2), emisiones no numéricas,
  flotantes (1.5), negativas, cero, desbordamientos de
  enteros de 32 bits, inyección de bytes nulos (\0) y saltos
  de línea (\n).
- RF-303: Resolución de carné distinguiendo entre códigos
  desconocidos y niños formalmente inactivos en la nómina.
- RF-302: Manejo de anomalías de reloj: detección de
  tiempos de recepción anteriores al envío (recibidoEn < enviadoEn), rechazo de desfases no finitos (NaN, Infinity).
- RF-302: Rechazo en horaEfectiva de desfases mayores a 24
  horas (86400000 ms), números no seguros y strings no
  válidos.
- RF-302: Validación de límites exactos de la ventana
  dominical de misa en Lima (07:30 a 09:30) con tolerancia
  de 10 minutos (rechazo de 07:19:59 y 09:40:01).
- RF-302: Precisión en comparación de instantes temporales
  considerando microsegundos de PostgreSQL.

#### 4. api/test/unit/asistencia/errores-lista-correccion.test.ts

- RF-306: Lanzamiento de excepción al intentar alternar un
  niño ajeno al borrador de la lista.
- RF-306: Bloqueo de confirmación de lista bajo
  condiciones no permitidas: sesión de tipo misa, sesión
  cancelada, cuenta sin dispositivoId registrado o roles sin
  atribución para pasar lista.
- RF-309: Rechazo de correcciones con horas incoherentes
  (posteriores al momento de recepción en el servidor o
  anteriores al domingo correspondiente).
- RF-309: Bloqueo de correcciones dominicales intentadas
  por autores distintos al registrador original, y exigencia
  de motivo no vacío para correcciones post-domingo por
  coordinación.
- RF-308: Consolidación determinista: marcas
  contradictorias resuelven a favor de presente, registran a
  ambos autores y activan la bandera conflicto: true.
  Retorno de null si no hay marcas aceptadas.

---

## 2. Resultados de Verificación Integral

| Comando              | Resultado                                                  |
| -------------------- | ---------------------------------------------------------- |
| npm run typecheck    | ✅ 0 errores (TypeScript estricto en raíz y API).          |
| npm run lint         | ✅ 0 errores (ESLint validado sin advertencias ni fallos). |
| npm --prefix api run | ✅ 19 suites unitarias test:rapido pasaron (119 tests).    |
