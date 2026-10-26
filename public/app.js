const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const sendLabel = document.querySelector("#send-label");
const characterCount = document.querySelector("#character-count");
const finishButton = document.querySelector("#finish-button");
const finishStatus = document.querySelector("#finish-status");
const typingMessage = "Escribiendo…";

let conversationId = null;
let assistantReplies = [];
let finishWindow = null;

function addMessage(text, role) {
  const article = document.createElement("article");
  article.className = `message ${role}-message`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "assistant" ? "✳" : "TÚ";

  const content = document.createElement("div");
  content.className = "message-content";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = role === "assistant" ? "ASISTENTE CON IA" : "TÚ";

  content.append(paragraph, time);
  article.append(avatar, content);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;

  return paragraph;
}

input.addEventListener("input", () => {
  characterCount.textContent = `${input.value.length} / 2000`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();

  if (!message || message.length > 2000 || sendButton.disabled) {
    return;
  }

  addMessage(message, "user");
  sendButton.disabled = true;
  input.disabled = true;
  finishButton.disabled = true;
  sendLabel.textContent = typingMessage;
  const pendingMessage = addMessage(typingMessage, "assistant");
  pendingMessage.setAttribute("aria-label", "El asistente está escribiendo");

  try {
    const requestBody = { message };
    if (conversationId) {
      requestBody.conversation_id = conversationId;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      pendingMessage.textContent =
        data?.error || `El servidor respondió con el error ${response.status}.`;
    } else if (
      typeof data?.reply !== "string" ||
      !data.reply.trim() ||
      !data?.conversation_id
    ) {
      pendingMessage.textContent =
        "El servidor devolvió una respuesta incompleta. Inténtalo de nuevo.";
    } else {
      conversationId = data.conversation_id;
      assistantReplies.push(data.reply);
      pendingMessage.textContent = data.reply;
      input.value = "";
      characterCount.textContent = "0 / 2000";
    }
  } catch {
    pendingMessage.textContent =
      "No se pudo conectar con el servidor. Comprueba que la aplicación esté activa e inténtalo de nuevo.";
  } finally {
    pendingMessage.removeAttribute("aria-label");
    sendButton.disabled = false;
    input.disabled = false;
    finishButton.disabled = false;
    sendLabel.textContent = "Enviar";
    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
});

finishButton.addEventListener("click", () => {
  finishWindow = window.open("/finalizacion.html", "_blank");

  if (!finishWindow) {
    finishStatus.textContent =
      "Permite las ventanas emergentes para abrir la página de finalización.";
    return;
  }

  finishStatus.textContent = "";
});

window.addEventListener("message", (event) => {
  if (
    event.origin !== window.location.origin ||
    event.source !== finishWindow ||
    event.data?.type !== "rinosoft-final-page-ready"
  ) {
    return;
  }

  finishWindow.postMessage(
    { type: "rinosoft-chat-responses", replies: assistantReplies },
    window.location.origin,
  );
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
