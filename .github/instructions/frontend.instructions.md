---
name: 'Frontend del chat'
description: 'Usar al crear o modificar la interfaz web del chatbot.'
applyTo: 'public/**'
---
# Reglas del frontend

## Tecnologías
* Solo HTML, CSS y JavaScript vanilla (ES2020+). Sin frameworks, CDNs, fuentes externas ni librerías.
* JavaScript en un solo archivo (`app.js`) cargado con `<script type="module">` o `defer`.

## Seguridad
* Inserta el texto del bot y del usuario con `textContent`, nunca con `innerHTML` (evita XSS).
* No guardes datos de la conversación en `localStorage` ni `sessionStorage`.
* El navegador solo llama a `POST /api/chat`; nunca a Foundry ni a otros servicios.
* No incluyas llaves, tokens ni endpoints en el código del cliente.

## Comportamiento del chat
* Guarda el `conversation_id` en una variable de JS; se reinicia al recargar.
  Envíalo en cada turno después del primero.
* Antes de enviar, recorta espacios y no envíes mensajes vacíos ni de más de 2000 caracteres
  (el servidor valida igual, pero así se evita una ida y vuelta inútil).
* Mientras espera respuesta, deshabilita el botón y el campo de texto, y muestra "Escribiendo…".
* Si el backend responde con error (422, 502 o fallo de red), muestra un mensaje amable en español,
  rehabilita el formulario y conserva el texto escrito para poder reintentar.
* Enviar con Enter; Shift+Enter inserta salto de línea.
* Haz scroll automático al último mensaje.

## Transparencia
* Muestra de forma visible que el usuario habla con una IA (por ejemplo, en el encabezado:
  "Asistente con IA: las respuestas pueden contener ALGUNOS errores").
* Distingue visualmente los mensajes del usuario y del bot.

## Accesibilidad
* Usa `<label>` (puede estar oculto visualmente) para el campo de texto.
* La lista de mensajes lleva `aria-live="polite"` para que los lectores de pantalla anuncien las respuestas.
* Contraste suficiente en modo claro y oscuro; el foco del teclado debe ser visible.
* `<html lang="es">` y `<meta name="viewport" content="width=device-width, initial-scale=1">`.

## Diseño
* Responsivo: debe verse bien a 360 px de ancho, sin scroll horizontal.
* Usa variables CSS en `:root` para colores y espaciado, y soporta `prefers-color-scheme: dark`.
* Los controles táctiles miden al menos 44 px de alto.
* Una sola vista: encabezado, lista de mensajes y formulario fijo abajo.