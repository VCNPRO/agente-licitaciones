import { VertexAI } from "@google-cloud/vertexai";

const SYSTEM_PROMPT = `Eres un experto clasificador de licitaciones públicas B2B para VCNpro AI. Clasifica este contrato en una de estas apps:

- SCRIPTORIUMIA: Transcripción, actas, digitalización de documentos históricos, archivos, manuscritos, OCR, IA documental
- VERBADOCSALUD: Documentación clínica por voz, dictado médico, informes sanitarios, historia clínica electrónica
- ANNALYSISMEDIA: Análisis y monitorización de medios de comunicación, prensa, clipping, seguimiento informativo
- VERBADOCPRO: Dictado profesional por voz, gestión documental, tratamiento de datos, software de documentación, SaaS
- VIDEOCONVERSION: Digitalización y conversión de archivos audiovisuales, escaneado, archivo fotográfico, restauración de imagen, impresión digital
- DESCARTADO: No encaja con ningún producto

IMPORTANTE: Los códigos CPV (Common Procurement Vocabulary) son la referencia principal para clasificar. Si se proporcionan, úsalos como criterio prioritario.

Devuelve SOLO un JSON válido con estas claves:
- Aplicacion_Mediasolam: una de las 6 opciones anteriores
- Nivel_de_Encaje: exactamente uno de ALTO, MEDIO o BAJO
- Presupuesto_Estimado: string con importe estimado (ej: "150.000 EUR") o "No especificado"
- Resumen_Ejecutivo: resumen de 1-2 frases
- Angulo_de_Venta: estrategia de venta en 1-2 frases`;

let vertexClient = null;

export function getVertexClient() {
  if (vertexClient) return vertexClient;

  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON no está configurada");
  }

  const credentials = JSON.parse(credentialsJson);

  vertexClient = new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: "europe-west4",
    googleAuthOptions: { credentials },
  });

  return vertexClient;
}

export function buildPrompt(item) {
  let prompt = `${SYSTEM_PROMPT}\n\nTítulo: ${item.title}\nDescripción: ${item.summary}`;

  if (item.cpvCodes && item.cpvCodes.length > 0) {
    prompt += `\nCódigos CPV: ${item.cpvCodes.join(", ")}`;
  }
  if (item.budget) {
    prompt += `\nPresupuesto: ${item.budget}`;
  }
  if (item.organism) {
    prompt += `\nOrganismo: ${item.organism}`;
  }
  if (item.cpvHint) {
    prompt += `\nSugerencia basada en CPV: posible encaje con ${item.cpvHint.join(", ")}`;
  }

  return prompt;
}

export async function classifyItem(item, model) {
  const prompt = buildPrompt(item);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text =
    response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  return JSON.parse(text);
}
