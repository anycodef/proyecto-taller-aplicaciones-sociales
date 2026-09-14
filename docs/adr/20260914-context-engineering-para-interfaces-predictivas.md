# 006 - Uso de Context Engineering para Interfaces Predictivas y Reducción de Digitación

- Status: accepted
- Date: 2026-09-14
- Tags: frontend ux mobile

## Contexto y problema

Uno de los requerimientos clave es minimizar el tiempo de digitación para evitar que los catequistas abandonen la herramienta y vuelvan al papel. Además, los padres de familia necesitan una forma de enviar justificaciones sin aprender a usar sistemas complejos. Una aplicación tradicional basada en formularios requeriría múltiples clics y tipeo para registrar la asistencia semanal y las evaluaciones de doctrina.

## Opciones consideradas

- Aplicación tradicional basada en formularios
- Interfaz predictiva construida mediante Context Engineering

## Decisión

Se aplicará la técnica de Context Engineering en el frontend. La aplicación construirá dinámicamente un "Objeto de Contexto" basado en variables implícitas como la hora del dispositivo, la fecha del calendario litúrgico, la geolocalización de la parroquia y el rol del usuario.

- Si el catequista abre la app un domingo a las 9:00 AM, la interfaz se adaptará automáticamente para mostrar directamente la lista de asistencia de su grupo específico, con todos los niños marcados como "Asistió" por defecto, requiriendo solo desmarcar a los ausentes.
- Para los padres, se generarán enlaces que pueden ser enviados por WhatsApp. Al abrir el enlace, el formulario de justificación ya tendrá precargado el nombre del niño y la fecha de la falta, requiriendo únicamente tomar la foto del comprobante médico.

### Consecuencias positivas

- Reduce drásticamente el tiempo de interacción del usuario, cumpliendo el requisito de ser más rápido que el registro en papel.
- Disminuye la curva de aprendizaje para los padres, logrando el objetivo de que reporten faltas fuera del chat personal de la coordinadora sin fricción.
- Mejora la adopción del sistema por parte de los voluntarios al ofrecerles un asistente proactivo.

### Consecuencias negativas

- Añade complejidad a la gestión del estado global en React Native, ya que la UI debe reaccionar y re-renderizarse basándose en reglas temporales y de contexto complejas.

## Enlaces

- Depende de [001 - Elección de React Native como framework Mobile-First](20260914-react-native-como-framework-mobile-first.md)
