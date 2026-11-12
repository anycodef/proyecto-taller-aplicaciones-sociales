# Mockups de SIGECAT

Referencia **visual** de las pantallas. No es fuente de verdad funcional.

## Reglas de uso

1. Si un mockup contradice una spec, **manda la spec** (`specs/NNN-*/spec.md`). Si ves la contradicción, repórtala; no la resuelvas por tu cuenta.
2. Los textos entre corchetes (`[seudónimo]`, `[catequista]`, `N años`, `versión N`) son marcadores: se reemplazan con datos reales.
3. Los nombres de niños, grupos y apoderados son datos de ejemplo. No son reglas de negocio.
4. Reutiliza `src/components/ui` y `src/tema`; no copies colores ni medidas desde la imagen.
5. Una tarea puede cubrir varias páginas. Abre todas las que se indican.

Archivos: La imagen de cada pantalla está en `app/` o `web/`. `app/app-01.png` … `app/app-81.png` y `web/web-01.png` … `web/web-15.png`(una por página, mismo orden).

## Spec 001 — Acceso y roles

La tabla de pantallas está en catalogo-pantallas.md

## Spec 002 — Perfil e inscripción

La tabla de pantallas está en catalogo-pantallas.md

## Spec 003 — Asistencia dominical

La tabla de pantallas está en catalogo-pantallas.md

## Plataformas

- `app/` es la app del equipo; `web/` es Expo web (familia y supervisión).
- Una pantalla web es un solo componente fluido. No se implementa dos veces.
- `legacy/` conserva el PDF y las `p-NN` originales. No usarlas en tareas nuevas;
  la equivalencia está en la columna "Antes" del catálogo.