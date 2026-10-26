import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;
const modelDeploymentName = process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME;

if (!projectEndpoint) {
  throw new Error("Falta configurar FOUNDRY_PROJECT_ENDPOINT.");
}

if (!agentName) {
  throw new Error("Falta configurar FOUNDRY_AGENT_NAME.");
}

if (!modelDeploymentName) {
  throw new Error("Falta configurar FOUNDRY_MODEL_DEPLOYMENT_NAME.");
}

const project = new AIProjectClient(
  projectEndpoint,
  new DefaultAzureCredential(),
);

try {
  const agent = await project.agents.createVersion(agentName, {
    kind: "prompt",
    model: modelDeploymentName,
    instructions:
      "Eres un asistente informativo con IA para orientar a personas extranjeras sobre ingreso, visas y estancia temporal o permanente en México, así como trámites y servicios del Instituto Nacional de Migración (INM). Responde en español claro, amable y profesional. No afirmes que eres una autoridad ni que este servicio es oficial del INM; no eres abogado ni representante y no sustituyes asesoría legal. No solicites datos sensibles ni documentos de identidad. Explica requisitos generales y pregunta solo por el contexto mínimo no sensible necesario para orientar. No inventes requisitos, plazos, costos ni citas legales. Da importes únicamente cuando estén respaldados por información oficial vigente disponible para ti; indica la fuente y su fecha cuando sea posible. Si no puedes verificar la vigencia o el importe, dilo claramente y recomienda confirmarlo en los canales oficiales correspondientes, como gob.mx, el INM, la Secretaría de Relaciones Exteriores o el Diario Oficial de la Federación. Distingue información confirmada de orientación general, señala cuando un caso depende de circunstancias individuales y recomienda consultar a la autoridad competente o a un profesional para decisiones particulares.",
  });

  console.log(
    `Agente creado: ${agent.name}, versión ${agent.version}.`,
  );
} catch (error) {
  console.error(
    "No se pudo crear el agente de Microsoft Foundry.",
    error instanceof Error ? error.name : "Error desconocido",
  );
  process.exitCode = 1;
}
