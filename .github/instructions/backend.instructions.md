---
name: 'Backend Express'
description: 'Usar al crear o modificar el backend Node.js (Express 5) que llama a Microsoft Foundry.'
applyTo: 'server.js,scripts/**'
---
# Reglas del backend

## Arranque
* Lee `FOUNDRY_PROJECT_ENDPOINT` y `FOUNDRY_AGENT_NAME` de `process.env` al iniciar.
  Si falta alguna, falla de inmediato con un mensaje claro (sin imprimir valores).
* `scripts/create-agent.js` también requiere `FOUNDRY_MODEL_DEPLOYMENT_NAME` para seleccionar el deployment del agente.
* Crea el `AIProjectClient` y el cliente de OpenAI una sola vez al iniciar, no en cada request.
  Usa `DefaultAzureCredential`.
* Escucha en `process.env.PORT`, con 3000 como valor por defecto en local.

## Llamadas a Foundry
* Para iniciar una conversación nueva usa `openai.conversations.create()`; para cada turno,
  `openai.responses.create({ conversation, input }, agentRef)`.
* Referencia al agente con
  `agentRef = { body: { agent_reference: { name: AGENT_NAME, type: "agent_reference" } } }`.
  Defínelo una sola vez, junto con los clientes.
* Valida la entrada (1 a 2000 caracteres) y responde 422 **antes** de llamar al SDK.
* Envuelve las llamadas al SDK en `try/catch` y responde 502 con un mensaje genérico.
  El detalle del error va solo a los logs del servidor.

## Express
* Usa `async/await`. En Express 5 los errores de handlers asíncronos llegan solos al manejador de errores;
  no hace falta envolverlos con utilidades extra.
* Define un único manejador de errores central (`(err, req, res, next)`) que nunca exponga trazas.
* `GET /health` responde `{ "status": "ok" }` sin llamar a Foundry.
* Limita el body con `express.json({ limit: "10kb" })`.

## Archivos y rutas
* Resuelve rutas de archivos con `import.meta.dirname`, no con el directorio actual:
  `path.join(import.meta.dirname, "public")`.

## Logs y dependencias
* No registres el contenido de los mensajes de los usuarios ni variables de entorno.
* No agregues dependencias nuevas sin mencionarlas en el plan.