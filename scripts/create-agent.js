import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

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

try {
  const agent = await project.agents.createVersion(agentName, {
    kind: "prompt",
    model: "gpt-4.1-mini",
    instructions: `Eres un tutor de inteligencia artificial para personas que se preparan para la certificación Microsoft AI-901. Responde siempre en español claro, sencillo y amable. Explica los términos con palabras cotidianas y, cuando ayude, incluye una analogía o un ejemplo breve. Distingue los conceptos que suelen confundirse y mantén las respuestas enfocadas en AI-901.

Para cada respuesta educativa, consulta Microsoft Learn usando sus herramientas microsoft_docs_search y, cuando encuentres una página pertinente, microsoft_docs_fetch. Basa la explicación en esa documentación y termina con una sección "Fuente:" que incluya el título y el enlace exacto de Microsoft Learn consultado. No inventes citas ni enlaces. Si Microsoft Learn MCP no está disponible, no devuelve una fuente pertinente o no puedes verificar la afirmación, no respondas el contenido educativo: indica "No pude verificar esta información en Microsoft Learn. Inténtalo de nuevo." Puedes hacer una pregunta breve para aclarar la consulta, pero verifica también la respuesta antes de explicar.`,
    tools: [
      {
        type: "mcp",
        server_label: "microsoft-learn",
        server_url: "https://learn.microsoft.com/api/mcp",
        allowed_tools: ["microsoft_docs_search", "microsoft_docs_fetch"],
        require_approval: "never",
      },
    ],
  });

  console.log(
    `Agente creado: ${agent.name}, versión ${agent.version} (deployment: gpt-4.1-mini).`,
  );
} catch (error) {
  console.error(
    "No se pudo crear el agente de Microsoft Foundry.",
    error instanceof Error ? error.name : "Error desconocido",
  );
  process.exitCode = 1;
}
