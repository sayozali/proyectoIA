const saveButton = document.querySelector("#save-response");
const completionStatus = document.querySelector("#completion-status");

let assistantReplies = [];

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function removeConversationalBoilerplate(reply) {
  return reply
    .replace(
      /(?:¡\s*)?hola[!.]?\s*¿?\s*(?:en qué puedo ayudarte(?: hoy)?|cómo puedo ayudarte)[^?]*\?\s*/giu,
      "",
    )
    .replace(/(?:^|\n)\s*(?:¡\s*)?hola[!,.]?\s*/giu, "")
    .replace(
      /(?:te pido por favor )?mantener el respeto en la conversación\.\s*/giu,
      "",
    )
    .replace(
      /(?:te pido por favor|por favor)[^.!?]*(?:mantener|mantengamos|mantén|mantenga)[^.!?]*(?:respeto|lenguaje adecuado)[^.!?]*[.!?]\s*/giu,
      "",
    )
    .replace(
      /estoy aquí para ayudarte con cualquier duda relacionada con migración en méxico o trámites (?:relacionados con el |del )instituto nacional de migración\.\s*/giu,
      "",
    )
    .replace(/estoy aquí para ayudarte[^.]*\.\s*/giu, "")
    .replace(/¿en qué más puedo (?:apoyarte|ayudarte)\?\s*/giu, "")
    .replace(/¿quieres saber sobre algún trámite o costo específico\?\s*/giu, "")
    .trim();
}

function getDocumentReplies() {
  return assistantReplies
    .map(removeConversationalBoilerplate)
    .filter(Boolean);
}

function createWordDocument() {
  const date = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const responseItems = getDocumentReplies()
    .map(
      (reply) =>
        `<li class="response">${escapeHtml(reply).replace(/\r?\n/g, "<br>")}</li>`,
    )
    .join("");
  const documentHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Respuestas del Chatbot RINOSOFT Gestoría</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; }
    .date { text-align: right; }
    h1 { font-size: 12pt; font-weight: bold; }
    p { line-height: 1.5; }
    .responses { margin: 0; padding-left: 24px; }
    .response { padding-left: 4px; text-align: justify; }
  </style>
</head>
<body>
  <p class="date">${escapeHtml(date)}</p>
  <h1>A QUIEN CORRESPONDA</h1>
  <ul class="responses">${responseItems}</ul>
  <p><strong>ATENTAMENTE</strong><br><strong>RINOSOFT GESTORÍA</strong></p>
</body>
</html>`;
  const blob = new Blob(["\uFEFF", documentHtml], {
    type: "application/msword;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "respuesta-chatbot-rinosoft.doc";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

saveButton.addEventListener("click", createWordDocument);

window.addEventListener("message", (event) => {
  if (
    event.origin !== window.location.origin ||
    event.source !== window.opener ||
    event.data?.type !== "rinosoft-chat-responses" ||
    !Array.isArray(event.data.replies) ||
    !event.data.replies.every(
      (reply) => typeof reply === "string" && reply.trim().length > 0,
    )
  ) {
    return;
  }

  assistantReplies = event.data.replies;
  const exportableReplyCount = getDocumentReplies().length;
  saveButton.disabled = exportableReplyCount === 0;
  completionStatus.textContent = exportableReplyCount
    ? `${exportableReplyCount} respuesta${exportableReplyCount === 1 ? "" : "s"} lista${exportableReplyCount === 1 ? "" : "s"} para guardar.`
    : "No hay respuestas de consultas para incluir en el documento.";
});

if (window.opener) {
  window.opener.postMessage(
    { type: "rinosoft-final-page-ready" },
    window.location.origin,
  );
} else {
  completionStatus.textContent =
    "Esta página debe abrirse desde la conversación para recuperar las respuestas.";
}
