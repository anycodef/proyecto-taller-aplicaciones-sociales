# Registros de Decisiones de Arquitectura (ADR)

Los ADR de este proyecto viven en esta carpeta como archivos markdown y se
gestionan con [Log4brains](https://github.com/thomvaill/log4brains), que genera
un sitio navegable a partir de ellos.

Los ADR se escriben **en español**. Los mensajes de commit van en inglés.

## Uso

No instales Log4brains como dependencia del proyecto: su React 17 choca con el
React 19 de la aplicación Next.js y rompe la generación del sitio. Por eso los
scripts lo ejecutan vía `npx`, con la versión fijada.

Previsualizar la base de conocimiento en local (con recarga en caliente):

```bash
npm run adr:preview
```

Crear un ADR nuevo de forma interactiva:

```bash
npm run adr:new
```

Generar el sitio estático en `.log4brains/out` (no se versiona):

```bash
npm run adr:build
```

## Convenciones

- Un ADR es inmutable: una vez aceptado, solo cambia su estado (`deprecated` o
  `superseded by ...`). Si la decisión cambia, se escribe un ADR nuevo que
  reemplaza al anterior.
- Estados en uso: `proposed`, `accepted`, `deprecated`, `superseded`.
- La sección "Opciones consideradas" es obligatoria: el valor del ADR está en
  dejar constancia de lo que se descartó y por qué.

## Más información

- [Documentación de Log4brains](https://github.com/thomvaill/log4brains/tree/develop#readme)
- [Qué es un ADR y por qué usarlos](https://github.com/thomvaill/log4brains/tree/develop#-what-is-an-adr-and-why-should-you-use-them)
- [Organización ADR en GitHub](https://adr.github.io/)
