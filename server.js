import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import express from "express";
import path from "node:path";


/*
SDK: SOFTWARE DEVELOPMENT KIT
AIProjectClient: Sirve para todo tipo de agente o de servicio de Microsoft Foundry
  - Este usa el endpoint del proyecto de Foundry
AzureOpenAIClient: Sirve para el modelo de lenguaje de agentes de tipo OpenAI GPT de Microsoft Foundry 
  - Este usa el endpoint del agente

*/

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;

if (!projectEndpoint) {
  throw new Error("Falta configurar FOUNDRY_PROJECT_ENDPOINT.");
}

if (!agentName) {
  throw new Error("Falta configurar FOUNDRY_AGENT_NAME.");
}

const project = new AIProjectClient(
  projectEndpoint,
  new DefaultAzureCredential(),
);
const openai = project.getOpenAIClient();
const app = express();
const port = process.env.PORT || 3000;

function getLearnUrls(text) {
  return new Set(
    [...text.matchAll(/https:\/\/learn\.microsoft\.com\/[^\s"'<>)}\]]+/gi)].map(
      ([url]) => url.replace(/[.,;:!?]+$/, ""),
    ),
  );
}

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(import.meta.dirname, "public")));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/chat", async (request, response) => {
  const body = request.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    response.status(422).json({ error: "Envía un mensaje válido." });
    return;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const requestedConversationId = body.conversation_id;

  if (message.length < 1 || message.length > 2000) {
    response.status(422).json({
      error: "El mensaje debe tener entre 1 y 2000 caracteres.",
    });
    return;
  }

  if (
    requestedConversationId !== undefined &&
    requestedConversationId !== null &&
    (typeof requestedConversationId !== "string" ||
      requestedConversationId.length > 256)
  ) {
    response.status(422).json({ error: "La conversación no es válida." });
    return;
  }

  try {
    const conversationId = requestedConversationId?.trim()
      ? requestedConversationId
      : (await openai.conversations.create()).id;
    const result = await openai.responses.create(
      {
        conversation: conversationId,
        input: message,
      },
      {
        body: {
          agent_reference: {
            name: agentName,
            type: "agent_reference",
          },
        },
      },
    );
    const successfulLearnSearch = result.output?.find(
      (item) =>
        item.type === "mcp_call" &&
        item.name === "microsoft_docs_search" &&
        item.status === "completed" &&
        !item.error &&
        Boolean(item.output?.trim()),
    );

    if (!result.output_text?.trim() || !successfulLearnSearch) {
      throw new Error("Foundry no devolvió una respuesta verificada por Learn.");
    }

    const citedLearnUrls = getLearnUrls(result.output_text);
    const searchedLearnUrls = getLearnUrls(successfulLearnSearch.output);
    if (![...citedLearnUrls].some((url) => searchedLearnUrls.has(url))) {
      throw new Error("La respuesta no cita una fuente devuelta por Learn.");
    }

    response.json({
      reply: result.output_text,
      conversation_id: conversationId,
    });
  } catch (error) {
    console.error(
      "Falló una solicitud de chat a Microsoft Foundry.",
      error instanceof Error ? error.name : "Error desconocido",
    );
    response.status(502).json({
      error: "No se pudo obtener una respuesta verificada. Inténtalo de nuevo.",
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
    response.status(error.type === "entity.too.large" ? 413 : 400).json({
      error:
        error.type === "entity.too.large"
          ? "La solicitud es demasiado grande."
          : "El cuerpo de la solicitud no contiene JSON válido.",
    });
    return;
  }

  console.error(
    "Falló el procesamiento de una solicitud HTTP.",
    error instanceof Error ? error.name : "Error desconocido",
  );
  response.status(500).json({ error: "Ocurrió un error inesperado." });
});

app.listen(port, () => {
  console.log(`Servidor listo en el puerto ${port}.`);
});
