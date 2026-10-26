import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import express from "express";
import path from "node:path";

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
const agentRef = {
  body: {
    agent_reference: {
      name: agentName,
      type: "agent_reference",
    },
  },
};
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10kb" }));
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
    (typeof requestedConversationId !== "string" ||
      requestedConversationId.length > 256)
  ) {
    response.status(422).json({ error: "La conversación no es válida." });
    return;
  }

  let operation = "crear la conversación";
  try {
    const conversationId = requestedConversationId?.trim()
      ? requestedConversationId.trim()
      : (await openai.conversations.create()).id;
    operation = "solicitar la respuesta del agente";
    const result = await openai.responses.create(
      {
        conversation: conversationId,
        input: message,
      },
      agentRef,
    );
    operation = "validar la respuesta del agente";
    if (!result.output_text?.trim()) {
      throw new Error("Foundry devolvió una respuesta vacía.");
    }

    response.json({
      reply: result.output_text,
      conversation_id: conversationId,
    });
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    let errorStatus;
    if (error && typeof error === "object") {
      if ("status" in error && typeof error.status === "number") {
        errorStatus = error.status;
      } else if ("statusCode" in error && typeof error.statusCode === "number") {
        errorStatus = error.statusCode;
      }
    }
    console.error("Falló una solicitud de chat a Microsoft Foundry.", {
      operation,
      name: error instanceof Error ? error.name : "Error desconocido",
      code: errorCode,
      status: errorStatus,
    });
    response.status(502).json({
      error: "No se pudo obtener una respuesta. Inténtalo de nuevo.",
    });
  }
});

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

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
