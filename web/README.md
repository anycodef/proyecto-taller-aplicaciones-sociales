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
3. `config.js`, que en el repositorio apunta a los servicios locales sin clave.

La clave de suscripción nunca se sube al repositorio: se entrega por el panel o por el enlace.

| Modo | CAT_BASE | ASIS_BASE | Clave |
|---|---|---|---|
| Servicios locales | `http://localhost:3001` | `http://localhost:3002` | vacía |
| Gateway local (plan B) | `http://localhost:8080/cat` | `http://localhost:8080/asis` | `demo-key` |
| Azure API Management | `https://<apim>.azure-api.net/cat` | `https://<apim>.azure-api.net/asis` | la del producto |

Enlace listo para el celular, una vez exista el APIM:

```
https://anycodef.github.io/proyecto-taller-aplicaciones-sociales/?cat=https://<apim>.azure-api.net/cat&asis=https://<apim>.azure-api.net/asis&key=<clave>
```

## En local

```bash
docker compose up --build                 # servicios en :3001 y :3002
npx serve web -l 5500                     # o: python -m http.server 5500 --directory web
```

Abrir `http://localhost:5500`. Es el origen que aceptan el CORS de los servicios y el del gateway.

## Qué necesita el backend para la versión publicada

- **HTTPS.** Una página https no puede llamar a `http://` salvo a `localhost` (contenido mixto).
  El panel lo avisa.
- **CORS para `https://anycodef.github.io`.** El gateway local solo permite `http://localhost:5500`
  (`ALLOWED_ORIGIN`) y `infra/apim/policy.xml` igual. Hay que agregar el origen de Pages; si no,
  el navegador bloquea las respuestas, incluidos el 401 y el 429.
- Comprobar que el 401 y el 429 del APIM salgan con cabeceras CORS (la política `cors` a nivel
  global ayuda). Si salen sin ellas, el navegador los oculta y el panel los informa como error de red.
