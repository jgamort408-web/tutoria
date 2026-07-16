# Auditoría de contenido, UI y UX · Tutoría Activa

Fecha de revisión: 16 de julio de 2026

Alcance: 40 páginas HTML, 29 recursos interactivos y sus componentes compartidos.

## Objetivo del producto

La plataforma se orienta prioritariamente a la tutoría de 1.º de ESO. Debe permitir que el profesorado localice, prepare y proyecte una sesión con rapidez, y que el alumnado entienda qué va a hacer, para qué y con qué normas de participación.

## Hallazgos de contenido

- La web ofrecía muchos recursos valiosos, pero la portada explicaba la arquitectura del proyecto en lugar de ayudar a elegir una sesión.
- La ruta de 1.º ESO enumeraba los módulos, aunque faltaban una puesta en marcha, una propuesta concreta para el primer mes y criterios sencillos de evaluación formativa.
- Los índices temáticos mezclaban etiquetas genéricas como «Abrir» con referencias a módulos, sin mostrar tiempo ni agrupamiento.
- Las actividades emocionales podían interpretarse como diagnósticas si no se explicaba su límite pedagógico.
- El panel académico no hacía suficientemente visible el cuidado de datos personales.
- Las actividades de evacuación necesitaban recordar que el protocolo oficial del centro prevalece sobre cualquier simulación web.

## Cambios de contenido desarrollados

- Portada reconstruida alrededor de necesidades reales del grupo: pertenencia, estudio y participación segura.
- Dos entradas explícitas, para profesorado y alumnado, con expectativas y derechos de participación.
- Ruta de 1.º ESO ampliada con tres pasos de uso, primer mes secuenciado, lista previa para el tutor o tutora y evaluación formativa no calificadora.
- Índices de Estudio, Emociones, Ciudadanía y Seguridad ordenados como secuencias, con duración y agrupamiento.
- Avisos específicos de cuidado emocional, privacidad y prevalencia del plan de autoprotección.
- Corrección de caracteres dañados y símbolos ilegibles en once actividades y en el panel de evaluación.

## Hallazgos de UI y UX

- La navegación de escritorio reunía demasiadas etiquetas largas y trataba por igual rutas desarrolladas y futuras.
- Las actividades tenían diseños internos distintos sin una referencia docente común.
- No existía un salto directo al contenido ni una respuesta global a la preferencia de movimiento reducido.
- El menú móvil no se cerraba con Escape ni restauraba siempre el desplazamiento al cambiar de tamaño.
- Los recursos compartidos no llevaban versión, lo que podía conservar estilos o scripts antiguos en caché tras un despliegue.

## Cambios de interfaz desarrollados

- Navegación común centrada en «Ruta 1.º ESO», ámbitos y zona docente.
- Ficha de sesión automática en las 29 actividades: propósito, tiempo, agrupamiento, preparación, audiencia y vuelta a la ruta anual.
- Nuevos patrones visuales reutilizables para inicio rápido, lista docente, avisos de privacidad y tarjetas de ruta.
- Comportamiento responsive específico para la ficha didáctica y los nuevos componentes.
- Enlaces y botones a ancho completo en pantallas pequeñas cuando mejora la pulsación táctil.
- Enlace «Saltar al contenido», foco visible y soporte para `prefers-reduced-motion`.
- Cierre del menú con Escape, recuperación del foco y limpieza del estado al superar el breakpoint móvil.
- Estilos de impresión que eliminan navegación y acciones secundarias.
- Versionado de CSS y JavaScript compartidos en las 40 páginas.

## Criterios pedagógicos aplicados

- Propósito visible antes de comenzar.
- Instrucciones y tiempos asumibles para alumnado recién incorporado a Secundaria.
- Participación segura: derecho a pasar, privacidad y ausencia de calificación emocional.
- Agrupamientos explícitos para evitar improvisación y aislamiento.
- Cierre breve basado en evidencia: aprendizaje, decisión, estrategia o pregunta.
- Separación clara entre recursos para alumnado y herramientas con datos para profesorado.

## Validación realizada

- Comprobación de estructura compartida en las 40 páginas: título, `h1`, viewport, CSS y JavaScript.
- Comprobación automática de enlaces y recursos locales: sin rutas rotas.
- Validación sintáctica de `assets/js/site.js` con Node.js.
- Revisión de diferencias con `git diff --check`.
- Prueba visual en navegador a 1265 × 720 px y 375 × 844 px.
- Prueba del menú móvil, portada, ruta anual y actividades representativas de Estudio y Emociones.
- Comprobación de ausencia de desbordamiento horizontal en escritorio y móvil.

## Recomendaciones para siguientes iteraciones

- Probar una sesión de cada bloque con un grupo real y registrar tiempo efectivo, dudas y abandono.
- Revisar lenguaje y ejemplos una vez al curso con Orientación, Coordinación de Igualdad y responsable del Plan de Autoprotección.
- Sustituir progresivamente manejadores `onclick` por eventos JavaScript separados y añadir pruebas automatizadas de cada actividad.
- Incorporar una política de conservación y borrado para cualquier dato académico utilizado en el panel docente.
- Realizar una auditoría WCAG manual con lector de pantalla y navegación exclusiva por teclado antes de una publicación institucional definitiva.
