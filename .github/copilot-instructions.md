# Instrucciones del proyecto: Chatbot RINOSOFT-Gestoría de Servicios Migratorios del Instituto Nacional de Migración (Foundry + App Service). 

## Qué es este proyecto
Página web de una sola vista con un chatbot experto en migración , impulsado por IA. Experto en Migración Mexicana, específicamente basado en las funciones que realiza el Instituto Nacional de Migración. Además podrá proporcionar información acerca de los costos de pagos de derechos y trámites migratorios.
- **Frontend:** HTML, CSS y JS sin frameworks, servido desde `public/`.
- **Backend:** Node.js con Express, que conversa con un agente de Microsoft Foundry.
- **Despliegue:** Azure App Service (Linux, Node 24 LTS).

## Entorno de desarrollo
- Windows 10 y PowerShell 7.
- Node.js 24 LTS y npm. Sin TypeScript ni bundlers.
- Los comandos de ejemplo deben ser de PowerShell, no de bash.

## Stack y versiones
- Express 5, ES Modules (`"type": "module"`), `async/await`.
- SDK de Foundry: `@azure/ai-projects` 2.x (API "Foundry projects (new)").
  No uses `@azure/ai-agents` ni la API 1.x.
- Autenticación: `DefaultAzureCredential` de `@azure/identity`.
- Variables de entorno en local con `node --env-file-if-exists=.env` (sin dotenv).
- No agregues dependencias nuevas sin preguntar.

## Estructura de archivos
```
├── server.js          # Backend Express
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example       # Solo nombres de variables, sin valores reales
├── .gitignore         # Debe incluir .env y node_modules
└── package.json
```

## Arquitectura (no la cambies sin preguntar)
- `server.js` sirve `public/` en `/`, expone `POST /api/chat` y `GET /health`.
- El navegador NUNCA habla directo con Foundry; solo el backend.
- Conversación multi-turno:
  - `openai.conversations.create()` para iniciar.
  - `openai.responses.create({ conversation, input }, agentRef)` para cada turno, donde
    `agentRef = { body: { agent_reference: { name, type: "agent_reference" } } }`.
- El servidor escucha en `process.env.PORT` (App Service lo define) con 3000 como valor por defecto en local.

## Contrato de la API
**`POST /api/chat`**
- Request: `{ "message": string, "conversation_id"?: string }`
- Respuesta 200: `{ "reply": string, "conversation_id": string }`
- Sin `conversation_id` se crea una conversación nueva; el frontend lo guarda y lo reenvía en cada turno.

| Código | Cuándo |
|--------|--------|
| 200 | Respuesta correcta |
| 422 | `message` ausente, no es texto o no tiene entre 1 y 2000 caracteres |
| 502 | Falla Foundry; mensaje genérico, sin trazas |

**`GET /health`** responde `{ "status": "ok" }` sin llamar a Foundry.

## Seguridad
- Nunca escribas llaves, tokens ni endpoints reales en el código. Todo sale de variables de entorno:
  `FOUNDRY_PROJECT_ENDPOINT` y `FOUNDRY_AGENT_NAME`; el script de creación también usa
  `FOUNDRY_MODEL_DEPLOYMENT_NAME`.
- En Azure se usa identidad administrada (managed identity), no API keys.
  La identidad necesita un rol con acceso al proyecto de Foundry (por ejemplo, Azure AI User).
- Valida la entrada y responde 422 si no cumple.
- Si Foundry falla, responde 502 con un mensaje genérico; registra el detalle solo en logs del servidor.
- No registres el contenido de los mensajes de los usuarios.
- Limita el tamaño del body JSON (por ejemplo, `express.json({ limit: "10kb" })`).

## Frontend
- Muestra siempre que el usuario habla con una IA (transparencia).
- Renderiza las respuestas con `textContent`, nunca con `innerHTML`, para evitar XSS.
- Deshabilita el botón de envío mientras espera respuesta y muestra un indicador de carga.
- Si el backend responde con error, muestra un mensaje amable y permite reintentar.
- Diseño responsivo; debe verse bien en celular.

## Estilo de código
- Comentarios en español neutro; nombres de variables en inglés.
- Cambios mínimos y enfocados: no reescribas archivos completos si basta editar.
- Funciones cortas; un manejador de errores central en Express.

## Scripts de `package.json`
- `start`: `node server.js` (lo usa App Service).
- `dev`: `node --env-file-if-exists=.env --watch server.js`.
- Define `"engines": { "node": ">=24" }`.

## Despliegue en App Service
- Variables de entorno en Configuración > Variables de entorno del App Service, nunca en el repositorio.
- Activa la identidad administrada asignada por el sistema y asígnale el rol en Foundry.
- Comando de inicio: `npm start` (o dejar el predeterminado si detecta `package.json`).
- Después de desplegar, verifica `https://<app>.azurewebsites.net/health`.

## Cómo validar
- Local: `npm run dev` y abrir http://localhost:3000
- Salud: `Invoke-RestMethod http://localhost:3000/health` debe devolver `status: ok`
- Prueba del chat:
```powershell
  Invoke-RestMethod -Method Post http://localhost:3000/api/chat `
    -ContentType "application/json" `
    -Body '{"message":"Hola"}'
```
- Prueba de validación: un mensaje vacío o de más de 2000 caracteres debe devolver 422.
- Antes de desplegar, confirma que `package.json` incluye todo lo que se importa y que `start` es `node server.js`.