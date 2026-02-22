import { VertexAI } from "@google-cloud/vertexai";
import Parser from "rss-parser";

const FEED_URL =
  "https://contrataciondelestado.es/sindicacion/sindicacion_1044/licitacionesPerfilesContratanteCompleto3.atom";

const SYSTEM_PROMPT = `Eres un experto clasificador de licitaciones públicas B2B para Mediasolam. Clasifica este contrato en una de estas apps: SCRIPTORIUMIA, VERBADOCSALUD, ANNALYSISMEDIA, VERBADOCPRO, VIDEOCONVERSION, o DESCARTADO. Devuelve SOLO un JSON válido con estas claves: Aplicacion_Mediasolam, Nivel_de_Encaje, Presupuesto_Estimado, Resumen_Ejecutivo, Angulo_de_Venta.`;

function buildPrompt(item) {
  const titulo = item.title || "Sin título";
  const descripcion =
    item.contentSnippet || item.content || item.summary || "Sin descripción";
  return `${SYSTEM_PROMPT}\n\nTítulo: ${titulo}\nDescripción: ${descripcion}`;
}

function getVertexClient() {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON no está configurada");
  }

  const credentials = JSON.parse(credentialsJson);

  return new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: "europe-west4",
    googleAuthOptions: {
      credentials,
    },
  });
}

export default async function handler(req, res) {
  // --- Auth ---
  const authHeader = req.headers["authorization"];
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    // --- Vertex AI ---
    const vertexAI = getVertexClient();
    const model = vertexAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // --- RSS Feed ---
    const parser = new Parser();
    const feed = await parser.parseURL(FEED_URL);
    const items = feed.items.slice(0, 5);

    // --- Clasificación ---
    const oportunidades = [];

    for (const item of items) {
      const prompt = buildPrompt(item);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text =
        response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      const clasificacion = JSON.parse(text);

      if (clasificacion.Aplicacion_Mediasolam !== "DESCARTADO") {
        oportunidades.push({
          titulo: item.title || "Sin título",
          link: item.link || "",
          ...clasificacion,
        });
      }
    }

    return res.status(200).json({ success: true, oportunidades });
  } catch (err) {
    console.error("Error en /api/scout:", err);
    return res.status(500).json({ error: err.message });
  }
}
