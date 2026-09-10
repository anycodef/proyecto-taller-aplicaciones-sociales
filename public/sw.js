/**
 * Service worker de la PWA.
 *
 * Estrategia deliberada: el cascaron de la aplicacion se sirve desde cache
 * para que abra sin red, y las escrituras nunca se cachean -- viajan por la
 * cola de sincronizacion, que es la unica dueña de los reintentos.
 */
const CACHE = "catequesis-v1";
const CASCARON = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CASCARON)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  if (peticion.method !== "GET") return;

  evento.respondWith(
    caches.match(peticion).then((enCache) => {
      const desdeRed = fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok && peticion.url.startsWith(self.location.origin)) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => enCache);

      // Cache primero para que la pantalla aparezca de inmediato en el
      // local, donde la senal no llega del primer al tercer piso.
      return enCache || desdeRed;
    }),
  );
});
