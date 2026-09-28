# Evidencias del gateway (plan B)

Generadas con `infra/scripts/evidencias.sh` contra el **gateway local** (`infra/gateway`, puerto 8090)
delante de las imágenes Docker reales de Catequizandos (rama `paquete-1`, commit 61e43a8) y Asistencia
(rama `paquete-2`, árbol de trabajo sin commit al momento de generarlas), ambas con `NODE_ENV=production`.

| Archivo | Muestra |
|---|---|
| `200-con-clave.txt` | `GET /cat/health` con clave: 200 |
| `401-sin-clave.txt` | `GET /cat/grupos` sin clave: 401 |
| `429-rafaga.txt` | 40 llamadas seguidas a `/cat/grupos`: 29 devuelven 200 y 11 devuelven 429 (límite 30/min) |

Son registros de texto, no capturas de pantalla, y **no provienen de Azure API Management**: no hubo acceso a la nube.
