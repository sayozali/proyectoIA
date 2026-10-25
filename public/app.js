const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const sendLabel = document.querySelector("#send-label");
const characterCount = document.querySelector("#character-count");

let conversationId = null;

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
  time.textContent = role === "assistant" ? "TU TUTOR · AI-901" : "TÚ";

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

  if (!message || sendButton.disabled) {
    return;
  }

  addMessage(message, "user");
  input.value = "";
  characterCount.textContent = "0 / 2000";
  sendButton.disabled = true;
  sendLabel.textContent = "Escribiendo…";
  const pendingMessage = addMessage("Estoy buscando una fuente de Microsoft Learn…", "assistant");
  pendingMessage.setAttribute("aria-label", "El tutor está escribiendo");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      pendingMessage.textContent =
        data?.error || `El servidor respondió con el error ${response.status}.`;
    } else if (!data?.reply || !data?.conversation_id) {
      pendingMessage.textContent =
        "El servidor devolvió una respuesta incompleta. Inténtalo de nuevo.";
    } else {
      conversationId = data.conversation_id;
      pendingMessage.textContent = data.reply;
    }
  } catch {
    pendingMessage.textContent =
      "No se pudo conectar con el servidor. Comprueba que la aplicación esté activa e inténtalo de nuevo.";
  } finally {
    pendingMessage.removeAttribute("aria-label");
    sendButton.disabled = false;
    sendLabel.textContent = "Enviar";
    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});
