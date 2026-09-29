# Web de demostración (paquete 4)

Pase de lista contra los dos microservicios, más el panel "Probar gateway" (401 y 429).
HTML y JavaScript sin framework ni compilación (SPEC §5).

Publicada en **https://anycodef.github.io/proyecto-taller-aplicaciones-sociales/**
por `.github/workflows/pages.yml` en cada push a `integracion` que toque `web/`.

## A qué backend habla

La conexión se resuelve en `conexion.js`, en este orden:

1. Parámetros de la URL: `?cat=<url>&asis=<url>&key=<clave>`. Se guardan en el navegador y se
   borran de la barra de direcciones.
2. Lo guardado en el panel **Conexión** de la propia página (solo en ese navegador).
3. `config.js`, que en el repositorio apunta al APIM (`https://sigecat-apim-31653.azure-api.net`)
   con su clave. La web publicada funciona sin configurar nada.

La clave en el frontend se acepta **solo para la demo** (SPEC §5); en producción iría detrás de
autenticación de usuario. Para volver a local, usar el panel o los parámetros de la URL.

| Modo | CAT_BASE | ASIS_BASE | Clave |
|---|---|---|---|
| Servicios locales | `http://localhost:3001` | `http://localhost:3002` | vacía |
| Gateway local (plan B) | `http://localhost:8080/cat` | `http://localhost:8080/asis` | `demo-key` |
| Azure API Management (por defecto) | `https://sigecat-apim-31653.azure-api.net/cat` | `https://sigecat-apim-31653.azure-api.net/asis` | la de `config.js` |

## En local

```bash
docker compose up --build                 # servicios en :3001 y :3002
npx serve web -l 5500                     # o: python -m http.server 5500 --directory web
```

Abrir `http://localhost:5500`. Es el origen que aceptan el CORS de los servicios y el del gateway.

## Qué necesita el backend para la versión publicada

Verificado contra el APIM desde el origen `https://anycodef.github.io`: HTTPS, CORS en las
respuestas 200 y 401, y preflight de `POST /asis/pases-de-lista` con la cabecera de la clave.
Si se cambia de gateway, necesita lo mismo: HTTPS y CORS para el origen de Pages, incluidos
el 401 y el 429.
