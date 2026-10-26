const saveButton = document.querySelector("#save-response");
const completionStatus = document.querySelector("#completion-status");

let assistantReplies = [];

function escapeXml(text) {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/[<>&'"]/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
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

function createTextRuns(text, bold = false) {
  const runProperties = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return text
    .split(/\r\n|\r|\n/)
    .map(
      (line, index) =>
        `${index ? "<w:r><w:br/></w:r>" : ""}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`,
    )
    .join("");
}

function calculateCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatenateBytes(chunks) {
  const result = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function createZipFile(files) {
  const encoder = new TextEncoder();
  const entries = files.map(([name, content]) => {
    const filename = encoder.encode(name);
    const data = encoder.encode(content);
    return { filename, data, crc: calculateCrc32(data) };
  });
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const localHeader = new Uint8Array(30 + entry.filename.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x21, true);
    localView.setUint32(14, entry.crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, entry.filename.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(entry.filename, 30);
    localParts.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + entry.filename.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, entry.crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, entry.filename.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(entry.filename, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + entry.data.length;
    centralSize += centralHeader.length;
  }

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return concatenateBytes([...localParts, ...centralParts, endRecord]);
}

function createWordDocument() {
  const date = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const responseParagraphs = getDocumentReplies()
    .map(
      (reply) =>
        `<w:p><w:pPr><w:ind w:left="360"/><w:spacing w:after="120"/></w:pPr>${createTextRuns(`• ${reply}`)}</w:p>`,
    )
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="right"/></w:pPr>${createTextRuns(date)}</w:p>
    <w:p>${createTextRuns("A QUIEN CORRESPONDA", true)}</w:p>
    ${responseParagraphs}
    <w:p>${createTextRuns("ATENTAMENTE", true)}</w:p>
    <w:p>${createTextRuns("RINOSOFT GESTORÍA", true)}</w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;
  const zipBytes = createZipFile([
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    ],
    ["word/document.xml", documentXml],
  ]);
  const blob = new Blob([zipBytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "respuesta-chatbot-rinosoft.docx";
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
