# 008 - Vuelta a una PWA mobile-first en lugar de React Native

- Status: accepted
- Date: 2026-09-14
- Tags: frontend mobile

## Contexto y problema

El ADR 001 eligió React Native y descartó la PWA apoyándose en tres argumentos: uso intensivo de la cámara, almacenamiento local seguro y una experiencia nativa fluida. Al contrastar esa decisión con el trabajo de campo de la Fase 1, dos hallazgos la contradicen directamente:

- **Los catequistas son menores de edad y no todos son dueños de su dispositivo.** Uno usa el celular de su madre. Instalar una aplicación desde la tienda en un teléfono ajeno no es un trámite técnico, es pedir permiso a un adulto que no forma parte del programa.
- **El equipo ya abandonó dos herramientas por fricción**, no por falta de funcionalidad: subir la asistencia a Drive y el rol de revisor de notificaciones. La restricción que ordena todo el diseño es que cualquier herramienta que agregue pasos será abandonada. La instalación es un paso, y ocurre antes de que la herramienta demuestre su valor.

A esto se suma que no todos tienen datos propios y se comparten conexión: descargar un instalador compite con el mismo dato móvil que hace falta para sincronizar.

Además, el ADR 006 ya decidió que los padres justifiquen faltas abriendo un enlace enviado por WhatsApp. Con React Native ese enlace exige o bien la app instalada con deep links, o bien un frontend web paralelo — es decir, dos bases de código, justo lo que el ADR 001 buscaba evitar.

## Decisores

Equipo de desarrollo (4 integrantes).

## Opciones consideradas

- Mantener React Native y añadir un frontend web mínimo para el flujo de justificaciones de los padres
- Mantener React Native y resolver las justificaciones con deep links sobre la app instalada
- Volver a una aplicación web progresiva (PWA) mobile-first, instalable pero utilizable sin instalar

## Decisión

Se desarrollará una **aplicación web progresiva (PWA) mobile-first**, tal como plantea la propuesta arquitectónica de la Fase 2. Este ADR reemplaza al 001.

La PWA será instalable en la pantalla de inicio, pero **no dependerá de estar instalada** para funcionar: el primer uso ocurre abriendo un enlace.

Revisión de los tres argumentos del ADR 001:

- **Cámara.** Fotografiar un comprobante médico se resuelve con la API web de captura de archivos. No se requiere procesamiento de imagen en el dispositivo; el OCR corre en el backend de forma asíncrona y fuera del camino crítico.
- **Almacenamiento local seguro.** IndexedDB con cifrado vía Web Crypto. Es más débil que Keychain/Keystore, pero el ADR 005 ya prohíbe que los documentos de identidad y la información médica lleguen al caché offline: lo que se guarda en el dispositivo son nombres, asistencia y avance de oraciones.
- **Experiencia nativa fluida.** El flujo dominante es una lista con toques, no una interfaz con gestos complejos o animación intensiva. La diferencia perceptible es marginal frente al costo de la instalación.

## Consecuencias

### Positivas

- Elimina la instalación como barrera de entrada: el catequista que usa el celular de su madre abre un enlace de WhatsApp y ya está trabajando.
- Un solo frontend cubre los tres roles, incluido el flujo de justificación por enlace del ADR 006, sin deep links ni una app web paralela.
- Las actualizaciones se despliegan sin pasar por revisión de tiendas, y sin cuenta de desarrollador de Apple (99 USD/año), que chocaba con la restricción de costo cero.
- No consume datos móviles compartidos en una descarga inicial; la carga es progresiva y se cachea.

### Negativas

- **Safari purga el almacenamiento tras 7 días sin visitas** en sitios no instalados en la pantalla de inicio. El uso de esta aplicación es semanal, así que el riesgo es real: un catequista con iPhone que no la instale puede perder la cola de sincronización pendiente entre un domingo y el siguiente. Mitigación: solicitar `navigator.storage.persist()`, promover la instalación en el primer uso y sincronizar al abrir antes de cualquier otra acción.
- La sincronización en segundo plano es limitada en iOS: la cola se vaciará al abrir la aplicación y no de forma autónoma.
- El cifrado en reposo es más débil que en una app nativa. Queda acotado por el ADR 005, no resuelto por él.

### Efectos sobre los ADR vigentes

El ADR 002 (Offline-First) sigue vigente en su estrategia — escritura local primero y cola de sincronización diferida — pero su mención a SQLite/WatermelonDB debe leerse como IndexedDB. El ADR 006 (Context Engineering) sigue vigente; su nota sobre el estado global en React Native aplica igual al estado del cliente en React. Si el equipo quiere fijar esas dos implementaciones concretas, corresponde escribir ADRs nuevos: un ADR aceptado es inmutable.

## Enlaces

- Reemplaza a [001 - Elección de React Native como framework Mobile-First](20260914-react-native-como-framework-mobile-first.md)
- Reinterpreta la implementación local de [002 - Estrategia de sincronización de datos Offline-First](20260914-estrategia-de-sincronizacion-offline-first.md)
- Se apoya en [005 - Implementación de Zero Trust Architecture (ZTA)](20260914-zero-trust-para-proteccion-de-datos-de-menores.md) para acotar qué datos viven en el dispositivo
- Habilita sin deep links el flujo de justificaciones de [006 - Uso de Context Engineering](20260914-context-engineering-para-interfaces-predictivas.md)
